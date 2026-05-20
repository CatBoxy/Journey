import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "jewelry.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS techniques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      difficulty TEXT DEFAULT 'beginner' CHECK(difficulty IN ('beginner', 'intermediate', 'advanced')),
      status TEXT DEFAULT 'want_to_learn' CHECK(status IN ('want_to_learn', 'learning', 'mastered')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      purchased INTEGER DEFAULT 0,
      url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'want_to_read' CHECK(status IN ('want_to_read', 'reading', 'read')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS technique_books (
      technique_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      PRIMARY KEY (technique_id, book_id),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technique_equipment (
      technique_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      PRIMARY KEY (technique_id, equipment_id),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technique_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technique_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technique_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technique_id INTEGER NOT NULL,
      text TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entry_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entry_id) REFERENCES technique_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entry_books (
      entry_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      PRIMARY KEY (entry_id, book_id),
      FOREIGN KEY (entry_id) REFERENCES technique_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entry_equipment (
      entry_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      PRIMARY KEY (entry_id, equipment_id),
      FOREIGN KEY (entry_id) REFERENCES technique_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    );
  `);
}

export default getDb;
