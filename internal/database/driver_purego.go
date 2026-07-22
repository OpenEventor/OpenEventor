//go:build purego

package database

// Pure-Go driver: modernc.org/sqlite. Used for CGO_ENABLED=0 cross-builds
// (OpenWRT routers — see packaging/openwrt) where no musl C toolchain exists.
// Same pragmas as the cgo driver, spelled in modernc's DSN syntax.

import _ "modernc.org/sqlite"

const (
	sqliteDriver = "sqlite"
	sqliteDSN    = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"
)
