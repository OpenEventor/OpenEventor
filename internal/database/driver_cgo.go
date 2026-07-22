//go:build !purego

package database

// Default driver: mattn/go-sqlite3 (cgo). Fastest option for the desktop/server
// builds where a C toolchain is available.

import _ "github.com/mattn/go-sqlite3"

const (
	sqliteDriver = "sqlite3"
	sqliteDSN    = "?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON"
)
