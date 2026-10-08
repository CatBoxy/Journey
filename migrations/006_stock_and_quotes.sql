-- Migration 006: Stock tracking, machines, and presupuestos (quotes)
-- Run against Turso with: turso db shell <db> < migrations/006_stock_and_quotes.sql
--
-- NOTE: SQLite ALTER TABLE ADD COLUMN does not support CHECK constraints.
-- Enum validation for new columns is enforced at the API layer.

-- ---- Materials: stock on hand + metal flag ----

ALTER TABLE materials ADD COLUMN stock_qty REAL DEFAULT 0;
-- current quantity on hand, in the material's unit

ALTER TABLE materials ADD COLUMN is_metal INTEGER DEFAULT 0;
-- 1 = precious/casting metal (silver, bronze). Quotes price it at today's
-- replacement price instead of the stock average, and apply metal loss.

ALTER TABLE materials ADD COLUMN notes TEXT DEFAULT '';

-- materials.unit_cost now holds the weighted average cost of the stock on hand.
-- It is recalculated on every purchase.

-- ---- Stock movements ----

CREATE TABLE IF NOT EXISTS material_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('purchase', 'job', 'rnd', 'adjustment')),
  quantity REAL NOT NULL,
  -- signed, in the material's unit: + adds stock, - removes it
  unit_cost REAL NOT NULL,
  -- purchase: price paid per unit; others: weighted average at the time
  total_cost REAL NOT NULL,
  -- quantity * unit_cost, in the material's currency (negative for usage)
  stock_after REAL NOT NULL,
  avg_cost_after REAL NOT NULL,
  quote_id INTEGER,
  expense_id INTEGER,
  date TEXT DEFAULT (date('now')),
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_material_movements_material ON material_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_type_date ON material_movements(type, date);

-- ---- Machines (cost per use) ----

CREATE TABLE IF NOT EXISTS machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  equipment_id INTEGER,
  purchase_price REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'ARS' CHECK(currency IN ('ARS', 'USD')),
  usage_unit TEXT NOT NULL DEFAULT 'hour' CHECK(usage_unit IN ('hour', 'cycle')),
  life_uses REAL NOT NULL DEFAULT 1,
  -- expected total uses over the machine's life (hours or cycles)
  energy_kwh_per_use REAL DEFAULT 0,
  extra_cost_per_use REAL DEFAULT 0,
  -- gas, LCD screen wear, crucible wear, etc. per use, in ARS
  notes TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
);

-- ---- Quotes (presupuestos) ----

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  client_contact TEXT DEFAULT '',
  description TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  date TEXT DEFAULT (date('now')),
  valid_until TEXT,
  metal_loss_pct REAL DEFAULT 0,
  failure_pct REAL DEFAULT 0,
  margin_pct REAL DEFAULT 0,
  deposit_pct REAL DEFAULT 0,
  price_breaks TEXT DEFAULT '',
  -- comma-separated alternative quantities to price on the PDF, e.g. "10,25,50"
  notes TEXT DEFAULT '',
  -- shown on the PDF (terms, delivery time, etc.)
  internal_notes TEXT DEFAULT '',
  total REAL,
  unit_price REAL,
  -- snapshot of the computed price at last save
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('material', 'labor', 'machine', 'one_time', 'other')),
  scope TEXT NOT NULL DEFAULT 'per_piece' CHECK(scope IN ('per_piece', 'per_batch')),
  material_id INTEGER,
  machine_id INTEGER,
  labor_type TEXT CHECK(labor_type IN ('design', 'bench') OR labor_type IS NULL),
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  -- grams / ml / units, hours of labor, machine uses, or 1 for a fixed cost
  unit TEXT DEFAULT '',
  unit_cost REAL NOT NULL DEFAULT 0,
  -- snapshot: stock average, today's metal price, labor rate, or machine rate
  apply_metal_loss INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL,
  FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);

-- ---- Starting data ----

-- Opening stock for the one material already loaded (1 bottle of resin, 500 g).
UPDATE materials SET stock_qty = 500 WHERE name LIKE 'Resina Creality Dura%' AND (stock_qty IS NULL OR stock_qty = 0);

-- Machines from the Oct 2026 purchases. life_uses, energy and extra costs are
-- first estimates; adjust them in the app as you learn real numbers.
INSERT INTO machines (name, equipment_id, purchase_price, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
SELECT 'Horno de descerado', 12, 1200000, 'cycle', 500, 8, 0,
  'Por ciclo de quemado completo. ~100 ciclos/año x 5 años. Energía estimada ~8 kWh por ciclo de 8 h.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Horno de descerado');

INSERT INTO machines (name, equipment_id, purchase_price, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
SELECT 'Mini vacum + bomba', 13, 1200000, 'cycle', 1000, 0.2, 0,
  'Por cilindro (desgasificar revestimiento + colar al vacío).'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Mini vacum + bomba');

INSERT INTO machines (name, equipment_id, purchase_price, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
SELECT 'Inyectora de cera', 40, 800000, 'hour', 1600, 0.3, 0,
  'Por hora de uso. ~200 h/año x 8 años. Falta sumar el compresor cuando se compre.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Inyectora de cera');

INSERT INTO machines (name, equipment_id, purchase_price, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
SELECT 'Vulcanizadora', 39, 800000, 'cycle', 400, 0.75, 0,
  'Por molde vulcanizado. ~50 moldes/año x 8 años.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Vulcanizadora');

INSERT INTO machines (name, equipment_id, purchase_price, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
SELECT 'Impresora Anycubic Photon Mono 4 Ultra', 46, 549000, 'hour', 3000, 0.1, 50,
  'Por hora de impresión. Extra = desgaste de pantalla LCD (~2000 h de vida). Actualizar con el precio real de la pantalla.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Impresora Anycubic Photon Mono 4 Ultra');

INSERT INTO machines (name, equipment_id, purchase_price, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
SELECT 'Mini soplete oxigas', 10, 415339, 'cycle', 2000, 0, 0,
  'Por fundida. Sumar el costo de gas y oxígeno por fundida cuando estén los tubos.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE name = 'Mini soplete oxigas');

-- Defaults for quoting (only set if missing)
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_metal_loss_pct', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_failure_pct', '10');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_margin_pct', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_deposit_pct', '50');
INSERT OR IGNORE INTO settings (key, value) VALUES ('quote_validity_days', '7');
INSERT OR IGNORE INTO settings (key, value) VALUES ('business_name', 'Kata');
