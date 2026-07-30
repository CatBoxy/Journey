-- Migration 005: Cost accounting
-- Run against Turso with: turso db shell <db> < migrations/005_cost_accounting.sql
--
-- NOTE: SQLite ALTER TABLE ADD COLUMN does not support CHECK constraints.
-- Enum validation for recurrence is enforced at the API layer.

-- ---- Expenses: recurrence, capital depreciation, FX ----

ALTER TABLE expenses ADD COLUMN recurrence TEXT DEFAULT 'none';
-- valid values: 'none', 'monthly', 'yearly' (enforced in API)

ALTER TABLE expenses ADD COLUMN is_capital INTEGER DEFAULT 0;

ALTER TABLE expenses ADD COLUMN useful_life_months INTEGER;
-- required when is_capital = 1 (enforced in API)

ALTER TABLE expenses ADD COLUMN fx_rate REAL;
-- ARS per USD on the transaction date

-- ---- Sales: FX + cost snapshot ----

ALTER TABLE sales ADD COLUMN fx_rate REAL;

ALTER TABLE sales ADD COLUMN unit_cost_at_sale REAL;
-- snapshot of product unit cost at the time of sale

-- ---- Products: price ----

ALTER TABLE products ADD COLUMN price REAL;

-- ---- Materials ----

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('g', 'ml', 'unit', 'cm')),
  unit_cost REAL NOT NULL,
  currency TEXT DEFAULT 'ARS' CHECK(currency IN ('ARS', 'USD')),
  supplier TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ---- Product bill of materials ----

CREATE TABLE IF NOT EXISTS product_materials (
  product_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  PRIMARY KEY (product_id, material_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- ---- Settings (key/value) ----

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---- Contributions (owner capital) ----

CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'ARS' CHECK(currency IN ('ARS', 'USD')),
  date TEXT DEFAULT (date('now')),
  description TEXT DEFAULT '',
  fx_rate REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---- Material price history ----

CREATE TABLE IF NOT EXISTS material_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  currency TEXT NOT NULL,
  effective_from TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);
