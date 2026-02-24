package config

import (
	"os"
	"time"
)

type Config struct {
	Port            string
	DataDir         string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

func Load() *Config {
	return &Config{
		Port:            envOrDefault("PORT", "3000"),
		DataDir:         envOrDefault("DATA_DIR", "./data"),
		JWTSecret:       envOrDefault("JWT_SECRET", "change-me-in-production"),
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
