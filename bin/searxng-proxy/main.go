package main

import (
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"
)

const defaultListenAddress = "127.0.0.1:8888"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	flags := flag.NewFlagSet("searxng-proxy", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	var configPath string
	var listenAddress string
	flags.StringVar(&configPath, "c", "", "path to the SearXNG YAML config")
	flags.StringVar(&configPath, "config", "", "path to the SearXNG YAML config")
	flags.StringVar(&listenAddress, "listen", defaultListenAddress, "HTTP listen address")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("unexpected positional arguments")
	}
	if configPath == "" {
		return errors.New("-c/--config is required")
	}

	file, err := os.Open(configPath)
	if err != nil {
		return fmt.Errorf("open config: %w", err)
	}
	settings, configErr := loadConfig(file)
	closeErr := file.Close()
	if configErr != nil {
		return configErr
	}
	if closeErr != nil {
		return fmt.Errorf("close config: %w", closeErr)
	}

	server := &http.Server{
		Addr:              listenAddress,
		Handler:           newSearchHandler(settings, newUpstreamClient()),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	fmt.Fprintf(os.Stderr, "SearXNG JSON proxy listening on %s\n", listenAddress)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("HTTP server failed: %w", err)
	}
	return nil
}
