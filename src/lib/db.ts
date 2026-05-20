import { createClient, type Client } from "@libsql/client/http";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN env vars");
    }
    client = createClient({ url, authToken });
  }
  return client;
}

export async function initSchema() {
  const db = getDb();
  const statements = [
    `CREATE TABLE IF NOT EXISTS techniques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      difficulty TEXT DEFAULT 'beginner' CHECK(difficulty IN ('beginner', 'intermediate', 'advanced')),
      status TEXT DEFAULT 'want_to_learn' CHECK(status IN ('want_to_learn', 'learning', 'mastered')),
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      purchased INTEGER DEFAULT 0,
      url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'want_to_read' CHECK(status IN ('want_to_read', 'reading', 'read')),
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS technique_books (
      technique_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      PRIMARY KEY (technique_id, book_id),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS technique_equipment (
      technique_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      PRIMARY KEY (technique_id, equipment_id),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS technique_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technique_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS technique_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technique_id INTEGER NOT NULL,
      text TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS entry_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entry_id) REFERENCES technique_entries(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS entry_books (
      entry_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      PRIMARY KEY (entry_id, book_id),
      FOREIGN KEY (entry_id) REFERENCES technique_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS entry_equipment (
      entry_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      PRIMARY KEY (entry_id, equipment_id),
      FOREIGN KEY (entry_id) REFERENCES technique_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    )`,
  ];
  await db.batch(statements.map((sql) => ({ sql, args: [] })));

  // Migrations — add url column to image tables (idempotent)
  for (const table of ["technique_images", "entry_images"]) {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN url TEXT DEFAULT ''`);
    } catch {
      // column already exists
    }
  }
}

let schemaReady: Promise<void> | null = null;

export async function db() {
  if (!schemaReady) {
    schemaReady = initSchema();
  }
  await schemaReady;
  return getDb();
}
