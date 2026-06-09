package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"sync"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v4/process"
)

type ProcessStat struct {
	PID  int32
	Name string
	CPU  float64
}

// limitProcess tracks a running limitcpu process for a given PID.
type limitProcess struct {
	cmd *exec.Cmd
}

func main() {
	match := flag.String("match", "", "regex to match process names")
	threshold := flag.Float64("threshold", 100.0, "CPU % threshold above which to apply limiting")
	limit := flag.Int("limit", 20, "CPU % limit per process (per core)")
	interval := flag.Duration("interval", 1*time.Second, "sampling interval")
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

	// Map of PID -> running limitcpu process
	mu := sync.Mutex{}
	limiterMap := make(map[int32]*limitProcess)

	fmt.Printf("autolimitcpu: monitoring processes matching %q (threshold: %.0f%%, limit: %d%%)\n",
		*match, *threshold, *limit)
	fmt.Println()

	for {
		procs, err := process.Processes()
		if err != nil {
			log.Printf("Failed to retrieve processes: %v", err)
			continue
		}

		statChan := make(chan ProcessStat, len(procs))
		var wg sync.WaitGroup

		for _, p := range procs {
			wg.Add(1)
			go func(proc *process.Process) {
				defer wg.Done()

				name, err := proc.Name()
				if err != nil || !re.MatchString(name) {
					return
				}

				cpuPercent, err := proc.Percent(*interval)
				if err != nil {
					return
				}

				statChan <- ProcessStat{
					PID:  proc.Pid,
					Name: name,
					CPU:  cpuPercent,
				}
			}(p)
		}

		wg.Wait()
		close(statChan)

		var highCPU []ProcessStat
		for stat := range statChan {
			if stat.CPU >= *threshold {
				highCPU = append(highCPU, stat)
			}
		}

		if len(highCPU) == 0 {
			continue
		}

		mu.Lock()

		// Clean up stale entries (limitcpu processes that have exited)
		for pid, lp := range limiterMap {
			err := lp.cmd.Process.Signal(syscall.Signal(0))
			if err != nil {
				// Process has exited, clean it up
				fmt.Printf("  limitcpu for PID %d (old process exited)\n", pid)
				delete(limiterMap, pid)
			}
		}

		for _, stat := range highCPU {
			// Check if we already have a limiter for this PID
			if _, exists := limiterMap[stat.PID]; exists {
				continue
			}

			// Spawn limitcpu
			fmt.Printf("limiting PID %d (%s) at %.1f%% -> %d%%\n",
				stat.PID, stat.Name, stat.CPU, *limit)

			cmd := exec.Command(
				limitcpuBin,
				"--pid", fmt.Sprintf("%d", stat.PID),
				"--limit", fmt.Sprintf("%d", *limit),
			)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			cmd.Stdin = os.Stdin

			if err := cmd.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "  failed to start limitcpu for PID %d: %v\n", stat.PID, err)
				continue
			}

			limiterMap[stat.PID] = &limitProcess{
				cmd: cmd,
			}
		}

		mu.Unlock()
	}
}
