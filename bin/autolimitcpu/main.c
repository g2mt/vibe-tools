#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <regex.h>
#include <errno.h>

#define MAX_PROCS   4096
#define MAX_NAME    256
#define PATH_LEN    512
#define STAT_BUF    2048

typedef struct {
    int    pid;
    int    present;
    unsigned long long last_cpu_ticks;
    int    limiter_pid;
    char   name[MAX_NAME];
} Entry;

static Entry     entries[MAX_PROCS];
static int       nentries;
static regex_t   regex;
static int       regex_compiled;
static double    threshold_val;
static int       limit_val;
static char      limitcpu_bin[PATH_LEN];
static volatile sig_atomic_t running = 1;
static long      clk_tck;

/* ------------------------------------------------------------------ */
/* signal handler                                                     */
/* ------------------------------------------------------------------ */
static void sig_handler(int sig)
{
    (void)sig;
    running = 0;
}

/* ------------------------------------------------------------------ */
/* find binary in PATH, return 1 on success                           */
/* ------------------------------------------------------------------ */
static int find_in_path(const char *name, char *out, size_t outlen)
{
    const char *path, *start, *end;
    struct stat st;

    path = getenv("PATH");
    if (!path) path = "/usr/local/bin:/usr/bin:/bin";

    start = path;
    for (;;) {
        end = strchrnul(start, ':');
        size_t dlen = (size_t)(end - start);
        if (dlen == 0) dlen = 1;             /* empty → "." */

        /* build candidate */
        size_t need = dlen + 1 + strlen(name) + 1;
        if (need > outlen) goto next;

        memcpy(out, start, dlen);
        out[dlen] = '/';
        strcpy(out + dlen + 1, name);

        if (stat(out, &st) == 0 && S_ISREG(st.st_mode) && (st.st_mode & 0111)) {
            /* check via access */
            if (access(out, X_OK) == 0) return 1;
        }

next:
        if (*end == '\0') break;
        start = end + 1;
    }
    return 0;
}

/* ------------------------------------------------------------------ */
/* reap dead limitcpu children (non-blocking)                         */
/* ------------------------------------------------------------------ */
static void reap_children(void)
{
    int status;
    pid_t pid;
    while ((pid = waitpid(-1, &status, WNOHANG)) > 0) {
        /* clear limiter_pid in the matching entry */
        for (int i = 0; i < nentries; i++) {
            if (entries[i].limiter_pid == pid) {
                entries[i].limiter_pid = 0;
                break;
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/* stop all running limiters and wait for them                        */
/* ------------------------------------------------------------------ */
static void kill_all_limiters(void)
{
    for (int i = 0; i < nentries; i++) {
        if (entries[i].limiter_pid > 0) {
            fprintf(stderr, "  stopping limiter for PID %d (shutting down)\n",
                    entries[i].pid);
            kill(entries[i].limiter_pid, SIGTERM);
            entries[i].limiter_pid = 0;
        }
    }
    /* reap all */
    while (waitpid(-1, NULL, 0) > 0)
        ;
}

/* ------------------------------------------------------------------ */
/* parse /proc/[pid]/stat: extract name, utime, stime, cutime, cstime */
/* returns 0 on failure                                                */
/* ------------------------------------------------------------------ */
static int parse_stat(int pid, char *name, size_t namesz,
                       unsigned long long *cpu_ticks)
{
    char path[64], buf[STAT_BUF];
    int fd, n;

    snprintf(path, sizeof(path), "/proc/%d/stat", pid);
    fd = open(path, O_RDONLY);
    if (fd < 0) return 0;
    n = (int)read(fd, buf, sizeof(buf) - 1);
    close(fd);
    if (n <= 0) return 0;
    buf[n] = '\0';

    /* find '(' and matching ')' - the comm field */
    char *lp = strchr(buf, '(');
    if (!lp) return 0;
    char *rp = strrchr(lp, ')');
    if (!rp) return 0;

    /* extract name between parens */
    size_t namelen = (size_t)(rp - lp - 1);
    if (namelen >= namesz) namelen = namesz - 1;
    memcpy(name, lp + 1, namelen);
    name[namelen] = '\0';

    /* after the ')', tokens are space-separated.
     * fields: state(3) ppid pgrp ... utime(14) stime(15) cutime(16) cstime(17)
     * we need fields 14-17 (0-indexed after ')': skip state → 10 more → utime)
     *
     * After ')' there is a space, then space-separated fields.
     * Field indices after comm (starting from field 3 = state):
     *  0: state   1: ppid  2: pgrp  3: session
     *  4: tty_nr  5: tpgid 6: flags 7: minflt
     *  8: cminflt 9: majflt 10: cmajflt
     *  11: utime  12: stime 13: cutime 14: cstime
     *
     * So we skip 11 tokens, then read 4.
     */
    char *p = rp + 1;  /* skip past ')' */
    char *saveptr;
    char *tok;
    int field = 0;

    tok = strtok_r(p, " ", &saveptr);
    while (tok) {
        if (field == 11) {        /* utime */
            *cpu_ticks = strtoull(tok, NULL, 10);
        } else if (field == 12) { /* stime */
            *cpu_ticks += strtoull(tok, NULL, 10);
        } else if (field == 13) { /* cutime */
            *cpu_ticks += strtoull(tok, NULL, 10);
        } else if (field == 14) { /* cstime */
            *cpu_ticks += strtoull(tok, NULL, 10);
            return 1; /* done */
        }
        field++;
        tok = strtok_r(NULL, " ", &saveptr);
    }
    return 0;
}

/* ------------------------------------------------------------------ */
/* spawn limitcpu for a given pid                                     */
/* ------------------------------------------------------------------ */
static int spawn_limiter(int target_pid)
{
    pid_t child = fork();
    if (child < 0) {
        fprintf(stderr, "  fork failed: %s\n", strerror(errno));
        return -1;
    }
    if (child == 0) {
        /* child: exec limitcpu */
        char pid_str[16], limit_str[16];

        snprintf(pid_str,   sizeof(pid_str),   "%d", target_pid);
        snprintf(limit_str, sizeof(limit_str), "%d", limit_val);

        execlp(limitcpu_bin, limitcpu_bin,
               "--monitor-forks", "--foreground",
               "-p", pid_str,
               "-l", limit_str,
               (char *)NULL);

        /* if execlp returns, it failed */
        fprintf(stderr, "  exec limitcpu failed: %s\n", strerror(errno));
        _exit(1);
    }
    return (int)child;
}

/* ------------------------------------------------------------------ */
/* find or create entry for pid, returns pointer or NULL if table full*/
/* ------------------------------------------------------------------ */
static Entry *find_entry(int pid)
{
    for (int i = 0; i < nentries; i++) {
        if (entries[i].pid == pid)
            return &entries[i];
    }
    if (nentries >= MAX_PROCS)
        return NULL;
    Entry *e = &entries[nentries++];
    memset(e, 0, sizeof(*e));
    e->pid = pid;
    return e;
}

/* ------------------------------------------------------------------ */
/* usage                                                               */
/* ------------------------------------------------------------------ */
static void usage(const char *prog)
{
    fprintf(stderr,
        "Usage: %s -match <regex> [-threshold <pct>] [-limit <pct>]\n"
        "\n"
        "Monitor processes matching a regex. When CPU usage exceeds the\n"
        "threshold, spawn limitcpu to cap it.\n"
        "\n"
        "Options:\n"
        "  -match     REGEX   process name regex (required)\n"
        "  -threshold PCT     CPU%% threshold above which to apply limit (default: 100)\n"
        "  -limit     PCT     CPU%% cap per process per core (default: 20)\n",
        prog);
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
int main(int argc, char *argv[])
{
    const char *match_arg  = NULL;
    double      thresh_arg = 100.0;
    int         limit_arg  = 20;

    /* --- parse argv --- */
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-match") == 0 && i + 1 < argc) {
            match_arg = argv[++i];
        } else if (strcmp(argv[i], "-threshold") == 0 && i + 1 < argc) {
            thresh_arg = atof(argv[++i]);
        } else if (strcmp(argv[i], "-limit") == 0 && i + 1 < argc) {
            limit_arg = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            usage(argv[0]);
            return 0;
        } else {
            fprintf(stderr, "Unknown option: %s\n", argv[i]);
            usage(argv[0]);
            return 1;
        }
    }

    if (!match_arg) {
        fprintf(stderr, "-match is required\n");
        usage(argv[0]);
        return 1;
    }

    /* --- compile regex --- */
    int rc = regcomp(&regex, match_arg, REG_EXTENDED | REG_NOSUB);
    if (rc != 0) {
        char errbuf[256];
        regerror(rc, &regex, errbuf, sizeof(errbuf));
        fprintf(stderr, "Invalid regex: %s\n", errbuf);
        return 1;
    }
    regex_compiled = 1;

    /* --- find limitcpu binary --- */
    if (!find_in_path("limitcpu", limitcpu_bin, sizeof(limitcpu_bin))) {
        fprintf(stderr, "limitcpu not found in PATH\n");
        regfree(&regex);
        return 1;
    }

    threshold_val = thresh_arg;
    limit_val     = limit_arg;
    clk_tck       = sysconf(_SC_CLK_TCK);
    if (clk_tck <= 0) clk_tck = 100;

    /* --- signal handling --- */
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = sig_handler;
    sigaction(SIGINT,  &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);
    /* SIGCHLD with SA_NOCLDWAIT so children are auto-reaped,
     * but we still want to know when they exit for cleanup.
     * Instead, use default SIGCHLD and reap manually. */
    sa.sa_handler = SIG_DFL;
    sigaction(SIGCHLD, &sa, NULL);
    /* but ignore SIGPIPE */
    signal(SIGPIPE, SIG_IGN);

    fprintf(stderr, "autolimitcpu: monitoring processes matching \"%s\" "
            "(threshold: %.0f%%, limit: %d%%)\n",
            match_arg, threshold_val, limit_val);

    /* --- main loop --- */
    while (running) {
        /* mark all as absent */
        for (int i = 0; i < nentries; i++)
            entries[i].present = 0;

        /* iterate /proc */
        DIR *proc = opendir("/proc");
        if (!proc) {
            fprintf(stderr, "Failed to open /proc: %s\n", strerror(errno));
            sleep(1);
            continue;
        }

        struct dirent *de;
        while ((de = readdir(proc)) != NULL) {
            /* only numeric directories */
            if (de->d_name[0] < '0' || de->d_name[0] > '9')
                continue;

            int pid = atoi(de->d_name);
            if (pid <= 0) continue;

            char name[MAX_NAME];
            unsigned long long cpu_ticks = 0;
            if (!parse_stat(pid, name, sizeof(name), &cpu_ticks))
                continue;

            /* check regex match */
            if (regexec(&regex, name, 0, NULL, 0) != 0)
                continue;

            Entry *e = find_entry(pid);
            if (!e) continue;   /* table full */
            e->present = 1;
            memcpy(e->name, name, MAX_NAME);

            /* CPU percentage:
             * we need two consecutive samples to compute delta.
             * On first sight, store baseline and skip. */
            if (e->last_cpu_ticks == 0) {
                e->last_cpu_ticks = cpu_ticks;
                continue;
            }

            unsigned long long delta = cpu_ticks - e->last_cpu_ticks;
            e->last_cpu_ticks = cpu_ticks;

            double cpu_pct = (double)delta * 100.0 / (double)clk_tck;

            if (cpu_pct < threshold_val) continue;

            /* already limiting? */
            if (e->limiter_pid > 0) continue;

            fprintf(stderr, "limiting PID %d (%s) at %.1f%% -> %d%%\n",
                    pid, name, cpu_pct, limit_val);

            e->limiter_pid = spawn_limiter(pid);
        }
        closedir(proc);

        /* clean up stale entries and exited limiters */
        reap_children();

        int dst = 0;
        for (int i = 0; i < nentries; i++) {
            if (!entries[i].present) {
                if (entries[i].limiter_pid > 0) {
                    fprintf(stderr, "  stopping limiter for PID %d (process exited)\n",
                            entries[i].pid);
                    kill(entries[i].limiter_pid, SIGTERM);
                }
                /* entry deleted (not copied to dst) */
            } else {
                if (dst != i)
                    entries[dst] = entries[i];
                dst++;
            }
        }
        nentries = dst;

        sleep(1);
    }

    /* cleanup */
    kill_all_limiters();
    regfree(&regex);

    return 0;
}
