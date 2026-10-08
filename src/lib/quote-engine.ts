// Pure cost engine for presupuestos (quotes). No DB access here, so it can be
// unit-tested and reused by the API, the MCP tools, and the PDF.

export type LineKind = "material" | "labor" | "machine" | "one_time" | "other";
export type LineScope = "per_piece" | "per_batch";

export interface QuoteLineInput {
  kind: LineKind;
  scope: LineScope;
  description: string;
  quantity: number;
  unit?: string;
  unit_cost: number;
  apply_metal_loss?: boolean | number;
  labor_type?: "design" | "bench" | null;
}

export interface QuoteParams {
  quantity: number;
  metal_loss_pct: number;
  failure_pct: number;
  margin_pct: number;
  deposit_pct: number;
}

export interface ComputedLine extends QuoteLineInput {
  effective_quantity: number;
  // quantity actually charged for the whole order (x pieces for per_piece,
  // plus metal loss when it applies)
  cost: number;
}

export type Section = "materials" | "labor" | "machines" | "one_time" | "other";

export interface QuoteBreakdown {
  quantity: number;
  lines: ComputedLine[];
  sections: Record<Section, number>;
  subtotal: number;
  recurring_subtotal: number;
  // everything except one-time costs; failure allowance applies to this
  failure_allowance: number;
  margin: number;
  total: number;
  unit_price: number;
  one_time_per_unit: number;
  deposit: number;
}

const SECTION_BY_KIND: Record<LineKind, Section> = {
  material: "materials",
  labor: "labor",
  machine: "machines",
  one_time: "one_time",
  other: "other",
};

export function sectionOf(kind: LineKind): Section {
  return SECTION_BY_KIND[kind];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Cost of one line for an order of `qty` pieces.
 *
 * - per_piece lines are multiplied by the number of pieces.
 * - per_batch lines (a burnout cycle, a print plate, setup time) are charged once.
 * - one_time lines (design, master, rubber mold) are always charged once, whatever their scope.
 * - metal lines with apply_metal_loss add the loss % on top of the weight.
 */
export function computeLine(line: QuoteLineInput, params: QuoteParams): ComputedLine {
  const qty = Math.max(1, Math.floor(params.quantity || 1));
  const perPiece = line.kind !== "one_time" && line.scope === "per_piece";
  let effective = (Number(line.quantity) || 0) * (perPiece ? qty : 1);
  if (line.kind === "material" && line.apply_metal_loss) {
    effective *= 1 + (Number(params.metal_loss_pct) || 0) / 100;
  }
  const cost = effective * (Number(line.unit_cost) || 0);
  return { ...line, effective_quantity: round2(effective), cost: round2(cost) };
}

export function computeQuote(lines: QuoteLineInput[], params: QuoteParams): QuoteBreakdown {
  const qty = Math.max(1, Math.floor(params.quantity || 1));
  const p = { ...params, quantity: qty };
  const computed = lines.map((l) => computeLine(l, p));

  const sections: Record<Section, number> = { materials: 0, labor: 0, machines: 0, one_time: 0, other: 0 };
  for (const l of computed) sections[sectionOf(l.kind)] += l.cost;
  for (const k of Object.keys(sections) as Section[]) sections[k] = round2(sections[k]);

  const subtotal = round2(Object.values(sections).reduce((a, b) => a + b, 0));
  const recurring = round2(subtotal - sections.one_time);
  const failure = round2(recurring * ((Number(p.failure_pct) || 0) / 100));
  const margin = round2((subtotal + failure) * ((Number(p.margin_pct) || 0) / 100));
  const total = round2(subtotal + failure + margin);

  return {
    quantity: qty,
    lines: computed,
    sections,
    subtotal,
    recurring_subtotal: recurring,
    failure_allowance: failure,
    margin,
    total,
    unit_price: round2(total / qty),
    one_time_per_unit: round2(sections.one_time / qty),
    deposit: round2(total * ((Number(p.deposit_pct) || 0) / 100)),
  };
}

/** Parse "10, 25,50" into [10, 25, 50], dropping junk, duplicates, and the base quantity. */
export function parsePriceBreaks(raw: string | null | undefined, baseQty?: number): number[] {
  if (!raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(/[,;\s]+/)) {
    const n = Math.floor(Number(part));
    if (Number.isFinite(n) && n > 0 && n !== baseQty) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

export interface PriceBreak {
  quantity: number;
  total: number;
  unit_price: number;
}

export function computePriceBreaks(lines: QuoteLineInput[], params: QuoteParams, quantities: number[]): PriceBreak[] {
  return quantities.map((q) => {
    const b = computeQuote(lines, { ...params, quantity: q });
    return { quantity: q, total: b.total, unit_price: b.unit_price };
  });
}

// ---- Machines ----

export interface MachineRateInput {
  purchase_price: number;
  life_uses: number;
  energy_kwh_per_use?: number | null;
  extra_cost_per_use?: number | null;
}

export interface MachineRate {
  wear: number;
  energy: number;
  extra: number;
  rate: number;
}

/** Cost of one use (hour or cycle) of a machine: wear + energy + extras. */
export function machineRate(m: MachineRateInput, kwhPrice: number): MachineRate {
  const life = Number(m.life_uses) > 0 ? Number(m.life_uses) : 1;
  const wear = (Number(m.purchase_price) || 0) / life;
  const energy = (Number(m.energy_kwh_per_use) || 0) * (Number(kwhPrice) || 0);
  const extra = Number(m.extra_cost_per_use) || 0;
  return { wear: round2(wear), energy: round2(energy), extra: round2(extra), rate: round2(wear + energy + extra) };
}

// ---- Stock (weighted average) ----

export interface StockState {
  stock_qty: number;
  avg_cost: number;
}

/** New stock and weighted average cost after buying `qty` units at `unitCost`. */
export function applyPurchase(state: StockState, qty: number, unitCost: number): StockState {
  // Negative stock (usage logged before the purchase) keeps counting, but only
  // positive stock on hand takes part in the average.
  const current = Number(state.stock_qty) || 0;
  const prevQty = Math.max(0, current);
  const newQty = current + qty;
  if (newQty <= 0 || prevQty === 0) return { stock_qty: round4(newQty), avg_cost: round4(unitCost) };
  const avg = (prevQty * (Number(state.avg_cost) || 0) + qty * unitCost) / (prevQty + qty);
  return { stock_qty: round4(newQty), avg_cost: round4(avg) };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
