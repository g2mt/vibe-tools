package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v4/process"
)

type Entry struct {
	p       *process.Process
	present bool
	limiter *exec.Cmd
}

func main() {
	match := flag.String("match", "", "regex to match process names")
	threshold := flag.Float64("threshold", 100.0, "CPU % threshold above which to apply limiting")
	limit := flag.Int("limit", 20, "CPU % limit per process (per core)")
	flag.Parse()

	if *match == "" {
		log.Fatal("-match is required")
	}

	re, err := regexp.Compile(*match)
	if err != nil {
		log.Fatalf("Invalid regex: %v", err)
	}

	// Find limitcpu binary
	limitcpuBin, err := exec.LookPath("limitcpu")
	if err != nil {
		log.Fatal("limitcpu not found in PATH")
	}

	procsByPid := make(map[int32]*Entry, 8)
	defer func() {
		for pid, entry := range procsByPid {
			if entry.limiter != nil {
				fmt.Printf("  stopping limiter for PID %d (process exited)\n", pid)
				entry.limiter.Process.Signal(syscall.SIGTERM)
				entry.limiter = nil
			}
		}
	}()

	fmt.Printf("autolimitcpu: monitoring processes matching %q (threshold: %.0f%%, limit: %d%%)\n",
		*match, *threshold, *limit)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case sig := <-sigChan:
			fmt.Printf("Interrupted by signal: %v.\n", sig)
			return
		case <-time.After(1 * time.Second):
		}

		// Mark all tracked processes as not present; fill in procsByPid from live procs.
		for _, entry := range procsByPid {
			entry.present = false
		}

		procs, err := process.Processes()
		if err != nil {
			log.Printf("Failed to retrieve processes: %v", err)
			continue
		}

		for _, p := range procs {
			entry, exists := procsByPid[p.Pid]
			if exists {
				entry.present = true
			}

			name, err := p.Name()
			if err != nil || !re.MatchString(name) {
				continue
			}

			if !exists {
				entry = &Entry{p: p, present: true}
				procsByPid[p.Pid] = entry
			}

			cpuPercent, err := entry.p.Percent(0)
			if err != nil {
				continue
			}

			if cpuPercent < *threshold {
				continue
			}

			// Spawn limitcpu if not already running
			if entry.limiter != nil {
				continue
			}

			fmt.Printf("limiting PID %d (%s) at %.1f%% -> %d%%\n",
				p.Pid, name, cpuPercent, *limit)

			cmd := exec.Command(
				limitcpuBin,
				"--monitor-forks",
				"--foreground",
				"-p", fmt.Sprintf("%d", p.Pid),
				"-l", fmt.Sprintf("%d", *limit),
			)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			cmd.Stdin = os.Stdin

			if err := cmd.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "  failed to start limitcpu for PID %d: %v\n", p.Pid, err)
				continue
			}

			entry.limiter = cmd
		}

		// Clean up stale entries and detect exited limiters
		for pid, entry := range procsByPid {
			if !entry.present {
				if entry.limiter != nil {
					fmt.Printf("  stopping limiter for PID %d (process exited)\n", pid)
					entry.limiter.Process.Signal(syscall.SIGTERM)
					entry.limiter = nil
				}
				delete(procsByPid, pid)
			}
		}
	}
}
