package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "github.com/mattn/go-sqlite3"
)

// Manager handles SQLite connections for system.db and event databases.
type Manager struct {
	dataDir  string
	systemDB *sql.DB
	mu       sync.RWMutex
	eventDBs map[string]*sql.DB
}

// NewManager creates a Manager and initializes the system database.
func NewManager(dataDir string) (*Manager, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	systemPath := filepath.Join(dataDir, "system.db")
	sysDB, err := openDB(systemPath)
	if err != nil {
		return nil, fmt.Errorf("open system.db: %w", err)
	}

	if err := RunMigrations(sysDB, "system"); err != nil {
		return nil, fmt.Errorf("migrate system.db: %w", err)
	}

	return &Manager{
		dataDir:  dataDir,
		systemDB: sysDB,
		eventDBs: make(map[string]*sql.DB),
	}, nil
}

// SystemDB returns the system database connection.
func (m *Manager) SystemDB() *sql.DB {
	return m.systemDB
}

// EventDB returns (or opens) the database for the given event ID.
// The database file must already exist on disk; use CreateEventDB to create a new one.
func (m *Manager) EventDB(eventID string) (*sql.DB, error) {
	m.mu.RLock()
	db, ok := m.eventDBs[eventID]
	m.mu.RUnlock()
	if ok {
		return db, nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock.
	if db, ok := m.eventDBs[eventID]; ok {
		return db, nil
	}

	filename := fmt.Sprintf("event_%s.db", eventID)
	dbPath := filepath.Join(m.dataDir, filename)

	// Check that the file exists — don't let SQLite silently create it.
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("event db %s does not exist", eventID)
	}

	db, err := openDB(dbPath)
	if err != nil {
		return nil, fmt.Errorf("open event db %s: %w", eventID, err)
	}

	if err := RunMigrations(db, "event"); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate event db %s: %w", eventID, err)
	}

	m.eventDBs[eventID] = db
	return db, nil
}

// CreateEventDB creates a new event database file and returns its connection.
func (m *Manager) CreateEventDB(eventID string) (*sql.DB, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	filename := fmt.Sprintf("event_%s.db", eventID)
	dbPath := filepath.Join(m.dataDir, filename)

	db, err := openDB(dbPath)
	if err != nil {
		return nil, fmt.Errorf("create event db %s: %w", eventID, err)
	}

	if err := RunMigrations(db, "event"); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate event db %s: %w", eventID, err)
	}

	m.eventDBs[eventID] = db
	return db, nil
}

// DataDir returns the data directory path.
func (m *Manager) DataDir() string {
	return m.dataDir
}

// CloseEventDB closes and removes the cached connection for an event.
func (m *Manager) CloseEventDB(eventID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if db, ok := m.eventDBs[eventID]; ok {
		db.Close()
		delete(m.eventDBs, eventID)
	}
}

// Close closes all open database connections.
func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var firstErr error
	for id, db := range m.eventDBs {
		if err := db.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close event db %s: %w", id, err)
		}
	}
	if err := m.systemDB.Close(); err != nil && firstErr == nil {
		firstErr = fmt.Errorf("close system.db: %w", err)
	}
	return firstErr
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON")
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
