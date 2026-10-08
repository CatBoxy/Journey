// DB-backed logic for stock, machines, and presupuestos. Shared by the API
// routes and the remote MCP server so both behave the same.

import { execute, buildPartialUpdate } from "@/lib/db";
import {
  applyPurchase,
  computeQuote,
  computePriceBreaks,
  machineRate,
  parsePriceBreaks,
  type LineKind,
  type LineScope,
  type QuoteLineInput,
  type QuoteBreakdown,
  type PriceBreak,
  type MachineRate,
} from "@/lib/quote-engine";

export class ValidationError extends Error {}

type Row = Record<string, unknown>;

function today(): string {
  // Workshop is in San Juan (UTC-3); avoid UTC rolling the date forward at night.
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().substring(0, 10);
}

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- Settings ----

export const QUOTE_SETTING_KEYS = [
  "labor_rate_design",
  "labor_rate_bench",
  "electricity_kwh_price",
  "default_metal_loss_pct",
  "default_failure_pct",
  "default_margin_pct",
  "default_deposit_pct",
  "quote_validity_days",
  "business_name",
  "business_contact",
  "last_silver_price_per_g",
  "last_silver_price_date",
] as const;

export async function getSettings(): Promise<Record<string, string>> {
  const result = await execute("SELECT key, value FROM settings");
  const s: Record<string, string> = {};
  for (const row of result.rows) s[row.key as string] = row.value as string;
  return s;
}

async function setSetting(key: string, value: string) {
  await execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export function laborRate(settings: Record<string, string>, type: "design" | "bench" | null | undefined): number {
  const fallback = num(settings.hourly_labor_rate);
  if (type === "design") return num(settings.labor_rate_design, fallback) || fallback;
  return num(settings.labor_rate_bench, fallback) || fallback;
}

function toArs(amount: number, currency: unknown, settings: Record<string, string>): number {
  if (currency === "USD") {
    const fx = num(settings.current_fx_rate);
    if (!fx) throw new ValidationError("Set current_fx_rate in settings to convert USD prices to ARS");
    return amount * fx;
  }
  return amount;
}

// ---- Stock ----

async function getMaterial(id: number): Promise<Row> {
  const r = await execute("SELECT * FROM materials WHERE id = ?", [id]);
  if (r.rows.length === 0) throw new ValidationError(`Material ${id} not found`);
  return r.rows[0];
}

export interface PurchaseInput {
  material_id: number;
  quantity: number;
  total_price: number;
  currency?: "ARS" | "USD";
  fx_rate?: number;
  date?: string;
  notes?: string;
  create_expense?: boolean;
}

/** Log a purchase: adds stock, recalculates the weighted average, and (by default) records the expense. */
export async function recordPurchase(input: PurchaseInput) {
  const qty = num(input.quantity);
  const total = num(input.total_price);
  if (qty <= 0) throw new ValidationError("quantity must be greater than 0");
  if (total < 0) throw new ValidationError("total_price cannot be negative");

  const material = await getMaterial(input.material_id);
  const matCurrency = (material.currency as string) || "ARS";
  const payCurrency = input.currency || matCurrency;

  // Convert the price paid into the material's own currency.
  let totalInMat = total;
  if (payCurrency !== matCurrency) {
    const fx = num(input.fx_rate);
    if (!fx) throw new ValidationError(`fx_rate is required when paying in ${payCurrency} for a material priced in ${matCurrency}`);
    totalInMat = payCurrency === "USD" ? total * fx : total / fx;
  }
  const unitCost = totalInMat / qty;
  const next = applyPurchase({ stock_qty: num(material.stock_qty), avg_cost: num(material.unit_cost) }, qty, unitCost);
  const date = input.date || today();

  let expenseId: number | null = null;
  if (input.create_expense !== false) {
    const exp = await execute(
      "INSERT INTO expenses (description, amount, currency, category, date, notes, fx_rate) VALUES (?, ?, ?, 'materials', ?, ?, ?)",
      [`${material.name} (${qty} ${material.unit})`, total, payCurrency, date, input.notes || "", input.fx_rate ?? null]
    );
    expenseId = Number(exp.lastInsertRowid);
  }

  const mv = await execute(
    `INSERT INTO material_movements (material_id, type, quantity, unit_cost, total_cost, stock_after, avg_cost_after, expense_id, date, notes)
     VALUES (?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.material_id, qty, round4(unitCost), round2(totalInMat), next.stock_qty, next.avg_cost, expenseId, date, input.notes || ""]
  );
  await execute("UPDATE materials SET stock_qty = ?, unit_cost = ?, updated_at = ? WHERE id = ?", [
    next.stock_qty, next.avg_cost, nowStamp(), input.material_id,
  ]);
  if (Math.abs(next.avg_cost - num(material.unit_cost)) > 1e-9) {
    await execute("INSERT INTO material_price_history (material_id, unit_cost, currency) VALUES (?, ?, ?)", [
      input.material_id, next.avg_cost, matCurrency,
    ]);
  }
  const row = await execute("SELECT * FROM material_movements WHERE id = ?", [mv.lastInsertRowid!]);
  return { movement: row.rows[0], material: await getMaterial(input.material_id) };
}

export type UsageType = "job" | "rnd" | "adjustment";

export interface UsageInput {
  material_id: number;
  type: UsageType;
  quantity: number;
  // amount used (positive). For "adjustment", a signed change (+ found, - lost).
  quote_id?: number;
  date?: string;
  notes?: string;
}

/** Log material leaving (or, for adjustments, entering) stock, valued at the current average. */
export async function recordUsage(input: UsageInput) {
  if (!["job", "rnd", "adjustment"].includes(input.type)) {
    throw new ValidationError("type must be job, rnd, or adjustment");
  }
  const raw = num(input.quantity);
  if (raw === 0) throw new ValidationError("quantity cannot be 0");
  const delta = input.type === "adjustment" ? raw : -Math.abs(raw);
  const material = await getMaterial(input.material_id);
  const avg = num(material.unit_cost);
  const stockAfter = round4(num(material.stock_qty) + delta);

  const mv = await execute(
    `INSERT INTO material_movements (material_id, type, quantity, unit_cost, total_cost, stock_after, avg_cost_after, quote_id, date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.material_id, input.type, delta, avg, round2(delta * avg), stockAfter, avg, input.quote_id ?? null, input.date || today(), input.notes || ""]
  );
  await execute("UPDATE materials SET stock_qty = ?, updated_at = ? WHERE id = ?", [stockAfter, nowStamp(), input.material_id]);
  const row = await execute("SELECT * FROM material_movements WHERE id = ?", [mv.lastInsertRowid!]);
  return { movement: row.rows[0], material: await getMaterial(input.material_id) };
}

/** Set stock to a counted amount; logs the difference as an adjustment (or R&D if as_rnd). */
export async function countStock(input: { material_id: number; counted_qty: number; as_rnd?: boolean; notes?: string; date?: string }) {
  const material = await getMaterial(input.material_id);
  const diff = round4(num(input.counted_qty) - num(material.stock_qty));
  if (diff === 0) return { movement: null, material };
  if (input.as_rnd && diff < 0) {
    return recordUsage({ material_id: input.material_id, type: "rnd", quantity: -diff, notes: input.notes, date: input.date });
  }
  return recordUsage({ material_id: input.material_id, type: "adjustment", quantity: diff, notes: input.notes || "Conteo de stock", date: input.date });
}

export async function listMovements(materialId?: number, limit = 200) {
  const where = materialId ? "WHERE mm.material_id = ?" : "";
  const args: unknown[] = materialId ? [materialId, limit] : [limit];
  const r = await execute(
    `SELECT mm.*, m.name AS material_name, m.unit AS unit, m.currency AS currency
     FROM material_movements mm JOIN materials m ON m.id = mm.material_id
     ${where} ORDER BY mm.date DESC, mm.id DESC LIMIT ?`,
    args
  );
  return r.rows;
}

/** R&D (absorbed) material cost per month, most recent first. */
export async function rndSummary() {
  const r = await execute(
    `SELECT substr(mm.date, 1, 7) AS month, m.currency AS currency, ROUND(-SUM(mm.total_cost), 2) AS cost, COUNT(*) AS movements
     FROM material_movements mm JOIN materials m ON m.id = mm.material_id
     WHERE mm.type = 'rnd' GROUP BY month, m.currency ORDER BY month DESC`
  );
  const byMaterial = await execute(
    `SELECT m.id AS material_id, m.name AS material_name, m.unit AS unit, m.currency AS currency,
            ROUND(-SUM(mm.quantity), 4) AS quantity, ROUND(-SUM(mm.total_cost), 2) AS cost
     FROM material_movements mm JOIN materials m ON m.id = mm.material_id
     WHERE mm.type = 'rnd' GROUP BY m.id ORDER BY cost DESC`
  );
  return { monthly: r.rows, by_material: byMaterial.rows };
}

// ---- Machines ----

export interface MachineWithRate extends Row {
  rate: MachineRate;
}

export async function listMachines(includeInactive = false): Promise<MachineWithRate[]> {
  const settings = await getSettings();
  const r = await execute(`SELECT * FROM machines ${includeInactive ? "" : "WHERE active = 1"} ORDER BY name`);
  return r.rows.map((m) => withRate(m, settings));
}

function withRate(m: Row, settings: Record<string, string>): MachineWithRate {
  const price = toArsSafe(num(m.purchase_price), m.currency, settings);
  return { ...m, rate: machineRate({ purchase_price: price, life_uses: num(m.life_uses, 1), energy_kwh_per_use: num(m.energy_kwh_per_use), extra_cost_per_use: num(m.extra_cost_per_use) }, num(settings.electricity_kwh_price)) };
}

function toArsSafe(amount: number, currency: unknown, settings: Record<string, string>): number {
  try { return toArs(amount, currency, settings); } catch { return amount; }
}

const MACHINE_FIELDS = ["name", "equipment_id", "purchase_price", "currency", "usage_unit", "life_uses", "energy_kwh_per_use", "extra_cost_per_use", "notes", "active"] as const;

function validateMachine(data: Row) {
  if (data.usage_unit !== undefined && !["hour", "cycle"].includes(data.usage_unit as string)) throw new ValidationError("usage_unit must be hour or cycle");
  if (data.currency !== undefined && !["ARS", "USD"].includes(data.currency as string)) throw new ValidationError("currency must be ARS or USD");
  if (data.life_uses !== undefined && num(data.life_uses) <= 0) throw new ValidationError("life_uses must be greater than 0");
}

export async function createMachine(data: Row) {
  if (!data.name) throw new ValidationError("name is required");
  validateMachine(data);
  const r = await execute(
    `INSERT INTO machines (name, equipment_id, purchase_price, currency, usage_unit, life_uses, energy_kwh_per_use, extra_cost_per_use, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.equipment_id ?? null, num(data.purchase_price), data.currency || "ARS", data.usage_unit || "hour", num(data.life_uses, 1) || 1, num(data.energy_kwh_per_use), num(data.extra_cost_per_use), data.notes || ""]
  );
  return getMachine(Number(r.lastInsertRowid));
}

export async function updateMachine(id: number, data: Row) {
  validateMachine(data);
  const fields: Record<string, unknown> = {};
  for (const k of MACHINE_FIELDS) if (data[k] !== undefined) fields[k] = k === "active" ? (data[k] ? 1 : 0) : data[k];
  const update = buildPartialUpdate("machines", id, fields);
  if (update) await execute(update.sql, update.args);
  return getMachine(id);
}

export async function getMachine(id: number) {
  const r = await execute("SELECT * FROM machines WHERE id = ?", [id]);
  if (r.rows.length === 0) throw new ValidationError(`Machine ${id} not found`);
  return withRate(r.rows[0], await getSettings());
}

// ---- Quotes ----

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
const LINE_KINDS: LineKind[] = ["material", "labor", "machine", "one_time", "other"];
const LINE_SCOPES: LineScope[] = ["per_piece", "per_batch"];

export interface QuoteLineData {
  kind: LineKind;
  scope?: LineScope;
  description?: string;
  quantity: number;
  unit?: string;
  unit_cost?: number | null;
  // omit to use the current price: stock average, labor rate, or machine rate
  material_id?: number | null;
  machine_id?: number | null;
  labor_type?: "design" | "bench" | null;
  apply_metal_loss?: boolean;
}

export interface QuoteData {
  title?: string;
  client_name?: string;
  client_contact?: string;
  description?: string;
  quantity?: number;
  status?: (typeof QUOTE_STATUSES)[number];
  date?: string;
  valid_until?: string | null;
  metal_loss_pct?: number;
  failure_pct?: number;
  margin_pct?: number;
  deposit_pct?: number;
  price_breaks?: string;
  notes?: string;
  internal_notes?: string;
  silver_price_per_g?: number;
  // shortcut: today's replacement price for metal lines that have no unit_cost
}

/** Fill in prices, units, and descriptions for lines that reference a material, machine, or labor type. */
async function resolveLines(lines: QuoteLineData[], settings: Record<string, string>, metalPrice?: number) {
  const out: Array<Required<Pick<QuoteLineData, "kind" | "scope" | "description" | "quantity" | "unit">> & {
    unit_cost: number; material_id: number | null; machine_id: number | null; labor_type: string | null; apply_metal_loss: number;
  }> = [];

  for (const [i, l] of lines.entries()) {
    if (!LINE_KINDS.includes(l.kind)) throw new ValidationError(`Line ${i + 1}: kind must be one of ${LINE_KINDS.join(", ")}`);
    const scope = l.scope || (l.kind === "machine" ? "per_batch" : "per_piece");
    if (!LINE_SCOPES.includes(scope)) throw new ValidationError(`Line ${i + 1}: scope must be per_piece or per_batch`);
    const quantity = num(l.quantity);
    if (quantity < 0) throw new ValidationError(`Line ${i + 1}: quantity cannot be negative`);

    let description = l.description || "";
    let unit = l.unit || "";
    let unitCost = l.unit_cost != null && l.unit_cost !== ("" as unknown) ? num(l.unit_cost) : null;
    let applyLoss = !!l.apply_metal_loss;
    let laborType: string | null = null;

    if (l.kind === "material" && l.material_id) {
      const m = await getMaterial(l.material_id);
      description ||= m.name as string;
      unit ||= m.unit as string;
      if (m.is_metal) {
        if (l.apply_metal_loss === undefined) applyLoss = true;
        if (unitCost == null) {
          if (metalPrice == null) throw new ValidationError(`Line ${i + 1}: ${m.name} is a metal. Give today's replacement price (unit_cost or silver_price_per_g)`);
          unitCost = metalPrice;
        }
      }
      if (unitCost == null) unitCost = toArs(num(m.unit_cost), m.currency, settings);
    } else if (l.kind === "machine" && l.machine_id) {
      const m = await getMachine(l.machine_id);
      description ||= m.name as string;
      unit ||= m.usage_unit === "cycle" ? "ciclo" : "h";
      if (unitCost == null) unitCost = m.rate.rate;
    } else if (l.kind === "labor") {
      laborType = l.labor_type || "bench";
      if (!["design", "bench"].includes(laborType)) throw new ValidationError(`Line ${i + 1}: labor_type must be design or bench`);
      description ||= laborType === "design" ? "Diseño / CAD" : "Trabajo de banco";
      unit ||= "h";
      if (unitCost == null) unitCost = laborRate(settings, laborType as "design" | "bench");
    }

    if (!description) throw new ValidationError(`Line ${i + 1}: description is required`);
    out.push({
      kind: l.kind, scope, description, quantity, unit,
      unit_cost: round4(unitCost ?? 0),
      material_id: l.kind === "material" ? l.material_id ?? null : null,
      machine_id: l.kind === "machine" ? l.machine_id ?? null : null,
      labor_type: laborType,
      apply_metal_loss: l.kind === "material" && applyLoss ? 1 : 0,
    });
  }
  return out;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

async function nextQuoteNumber(): Promise<string> {
  const year = today().substring(0, 4);
  const r = await execute("SELECT number FROM quotes WHERE number LIKE ? ORDER BY id DESC LIMIT 1", [`P-${year}-%`]);
  const last = r.rows[0]?.number as string | undefined;
  const n = last ? parseInt(last.split("-")[2], 10) + 1 : 1;
  return `P-${year}-${String(n).padStart(3, "0")}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

function validateQuote(data: QuoteData) {
  if (data.status !== undefined && !QUOTE_STATUSES.includes(data.status)) throw new ValidationError(`status must be one of ${QUOTE_STATUSES.join(", ")}`);
  if (data.quantity !== undefined && (!Number.isFinite(Number(data.quantity)) || Number(data.quantity) < 1)) throw new ValidationError("quantity must be at least 1");
  for (const k of ["metal_loss_pct", "failure_pct", "margin_pct", "deposit_pct"] as const) {
    if (data[k] !== undefined && (num(data[k], -1) < 0)) throw new ValidationError(`${k} cannot be negative`);
  }
}

async function rememberSilverPrice(price: number | undefined) {
  if (price == null || !(price > 0)) return;
  await setSetting("last_silver_price_per_g", String(price));
  await setSetting("last_silver_price_date", today());
}

async function writeLines(quoteId: number, lines: Awaited<ReturnType<typeof resolveLines>>) {
  await execute("DELETE FROM quote_lines WHERE quote_id = ?", [quoteId]);
  for (const [i, l] of lines.entries()) {
    await execute(
      `INSERT INTO quote_lines (quote_id, kind, scope, material_id, machine_id, labor_type, description, quantity, unit, unit_cost, apply_metal_loss, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [quoteId, l.kind, l.scope, l.material_id, l.machine_id, l.labor_type, l.description, l.quantity, l.unit, l.unit_cost, l.apply_metal_loss, i]
    );
  }
}

async function saveTotals(quoteId: number) {
  const q = await getQuote(quoteId);
  await execute("UPDATE quotes SET total = ?, unit_price = ?, updated_at = ? WHERE id = ?", [q.breakdown.total, q.breakdown.unit_price, nowStamp(), quoteId]);
  return { ...q, quote: { ...q.quote, total: q.breakdown.total, unit_price: q.breakdown.unit_price } };
}

export async function createQuote(data: QuoteData, lines: QuoteLineData[] = []) {
  if (!data.title) throw new ValidationError("title is required");
  validateQuote(data);
  const settings = await getSettings();
  const resolved = await resolveLines(lines, settings, data.silver_price_per_g);
  const date = data.date || today();
  const validDays = num(settings.quote_validity_days, 7);
  const pick = (v: number | undefined, key: string, fallback: number) => (v != null ? num(v) : num(settings[key], fallback));

  const r = await execute(
    `INSERT INTO quotes (number, title, client_name, client_contact, description, quantity, status, date, valid_until,
       metal_loss_pct, failure_pct, margin_pct, deposit_pct, price_breaks, notes, internal_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      await nextQuoteNumber(), data.title, data.client_name || "", data.client_contact || "", data.description || "",
      Math.floor(num(data.quantity, 1)) || 1, data.status || "draft", date, data.valid_until || addDays(date, validDays),
      pick(data.metal_loss_pct, "default_metal_loss_pct", 5), pick(data.failure_pct, "default_failure_pct", 10),
      pick(data.margin_pct, "default_margin_pct", 30), pick(data.deposit_pct, "default_deposit_pct", 50),
      data.price_breaks || "", data.notes || "", data.internal_notes || "",
    ]
  );
  const id = Number(r.lastInsertRowid);
  await writeLines(id, resolved);
  await rememberSilverPrice(data.silver_price_per_g);
  return saveTotals(id);
}

const QUOTE_FIELDS = ["title", "client_name", "client_contact", "description", "quantity", "status", "date", "valid_until", "metal_loss_pct", "failure_pct", "margin_pct", "deposit_pct", "price_breaks", "notes", "internal_notes"] as const;

/** Update quote fields. If `lines` is given it replaces all lines. */
export async function updateQuote(id: number, data: QuoteData, lines?: QuoteLineData[]) {
  validateQuote(data);
  await getQuoteRow(id);
  const fields: Record<string, unknown> = {};
  for (const k of QUOTE_FIELDS) if (data[k] !== undefined) fields[k] = k === "quantity" ? Math.floor(num(data[k], 1)) : data[k];
  const update = buildPartialUpdate("quotes", id, fields);
  if (update) await execute(update.sql, update.args);
  if (lines) {
    const resolved = await resolveLines(lines, await getSettings(), data.silver_price_per_g);
    await writeLines(id, resolved);
    await rememberSilverPrice(data.silver_price_per_g);
  }
  return saveTotals(id);
}

/** Re-price lines that reference stock, machines, or labor using today's numbers. Metal lines keep their price unless a new one is given. */
export async function repriceQuote(id: number, silverPricePerG?: number) {
  const { lines } = await getQuote(id);
  const data: QuoteLineData[] = [];
  for (const l of lines) {
    const isMetal = l.material_id ? !!(await getMaterial(Number(l.material_id))).is_metal : false;
    const keepPrice = !l.material_id && !l.machine_id && l.kind !== "labor";
    data.push({
      kind: l.kind as LineKind, scope: l.scope as LineScope, description: l.description as string,
      quantity: num(l.quantity), unit: l.unit as string,
      material_id: (l.material_id as number) ?? null, machine_id: (l.machine_id as number) ?? null,
      labor_type: (l.labor_type as "design" | "bench") ?? null, apply_metal_loss: !!l.apply_metal_loss,
      unit_cost: keepPrice || (isMetal && silverPricePerG == null) ? num(l.unit_cost) : null,
    });
  }
  return updateQuote(id, { silver_price_per_g: silverPricePerG }, data);
}

async function getQuoteRow(id: number): Promise<Row> {
  const r = await execute("SELECT * FROM quotes WHERE id = ?", [id]);
  if (r.rows.length === 0) throw new ValidationError(`Quote ${id} not found`);
  return r.rows[0];
}

export interface FullQuote {
  quote: Row;
  lines: Row[];
  breakdown: QuoteBreakdown;
  price_breaks: PriceBreak[];
}

export async function getQuote(id: number): Promise<FullQuote> {
  const quote = await getQuoteRow(id);
  const lr = await execute("SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort, id", [id]);
  const inputs: QuoteLineInput[] = lr.rows.map((l) => ({
    kind: l.kind as LineKind, scope: l.scope as LineScope, description: l.description as string,
    quantity: num(l.quantity), unit: l.unit as string, unit_cost: num(l.unit_cost),
    apply_metal_loss: !!l.apply_metal_loss, labor_type: (l.labor_type as "design" | "bench") ?? null,
  }));
  const params = {
    quantity: num(quote.quantity, 1), metal_loss_pct: num(quote.metal_loss_pct), failure_pct: num(quote.failure_pct),
    margin_pct: num(quote.margin_pct), deposit_pct: num(quote.deposit_pct),
  };
  const breakdown = computeQuote(inputs, params);
  const lines = lr.rows.map((l, i) => ({ ...l, effective_quantity: breakdown.lines[i].effective_quantity, cost: breakdown.lines[i].cost }));
  const price_breaks = computePriceBreaks(inputs, params, parsePriceBreaks(quote.price_breaks as string, params.quantity));
  return { quote, lines, breakdown, price_breaks };
}

export async function listQuotes(status?: string) {
  if (status && !QUOTE_STATUSES.includes(status as (typeof QUOTE_STATUSES)[number])) throw new ValidationError("invalid status");
  const r = await execute(
    `SELECT id, number, title, client_name, quantity, status, date, valid_until, total, unit_price, updated_at FROM quotes
     ${status ? "WHERE status = ?" : ""} ORDER BY id DESC`,
    status ? [status] : []
  );
  return r.rows;
}

export async function deleteQuote(id: number) {
  await getQuoteRow(id);
  await execute("DELETE FROM quote_lines WHERE quote_id = ?", [id]);
  await execute("DELETE FROM quotes WHERE id = ?", [id]);
}

export function errorResponse(e: unknown) {
  if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 });
  console.error(e);
  return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
}

export { round2 };
