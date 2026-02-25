package database

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/openeventor/openeventor/internal/auth"
)

// EnsureDefaultUser creates an admin user if the users table is empty.
func EnsureDefaultUser(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil
	}

	hash, err := auth.HashPassword("admin")
	if err != nil {
		return fmt.Errorf("hash default password: %w", err)
	}

	id := uuid.New().String()
	_, err = db.Exec(
		"INSERT INTO users (id, login, password_hash, name, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
		id, "admin", hash, "Administrator",
	)
	if err != nil {
		return fmt.Errorf("insert default user: %w", err)
	}

	log.Printf("created default admin user (login: admin, password: admin)")
	return nil
}
