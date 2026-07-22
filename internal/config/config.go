package config

import (
	"os"
)

type Config struct {
	Port    string
	DataDir string
}

func Load() *Config {
	return &Config{
		Port:    envOrDefault("PORT", "5050"),
		DataDir: envOrDefault("DATA_DIR", "./data"),
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
