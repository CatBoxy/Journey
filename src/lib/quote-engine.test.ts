import { describe, it, expect } from "vitest";
import {
  computeQuote,
  computeLine,
  computePriceBreaks,
  parsePriceBreaks,
  machineRate,
  applyPurchase,
  type QuoteLineInput,
  type QuoteParams,
} from "./quote-engine";

const base: QuoteParams = { quantity: 1, metal_loss_pct: 0, failure_pct: 0, margin_pct: 0, deposit_pct: 0 };

function line(overrides: Partial<QuoteLineInput>): QuoteLineInput {
  return { kind: "material", scope: "per_piece", description: "x", quantity: 1, unit_cost: 100, ...overrides };
}

describe("computeLine", () => {
  it("multiplies per-piece lines by the number of pieces", () => {
    const l = computeLine(line({ quantity: 2, unit_cost: 10 }), { ...base, quantity: 5 });
    expect(l.effective_quantity).toBe(10);
    expect(l.cost).toBe(100);
  });

  it("charges per-batch lines once", () => {
    const l = computeLine(line({ kind: "machine", scope: "per_batch", quantity: 1, unit_cost: 2400 }), { ...base, quantity: 20 });
    expect(l.cost).toBe(2400);
  });

  it("charges one-time lines once even if marked per piece", () => {
    const l = computeLine(line({ kind: "one_time", scope: "per_piece", quantity: 1, unit_cost: 50000 }), { ...base, quantity: 30 });
    expect(l.cost).toBe(50000);
  });

  it("adds metal loss only when asked", () => {
    const params = { ...base, quantity: 2, metal_loss_pct: 5 };
    const silver = computeLine(line({ quantity: 10, unit_cost: 2000, apply_metal_loss: true }), params);
    expect(silver.effective_quantity).toBe(21);
    expect(silver.cost).toBe(42000);
    const resin = computeLine(line({ quantity: 10, unit_cost: 60.8 }), params);
    expect(resin.effective_quantity).toBe(20);
  });

  it("ignores metal loss on non-material lines", () => {
    const l = computeLine(line({ kind: "labor", quantity: 1, unit_cost: 1000, apply_metal_loss: true }), { ...base, metal_loss_pct: 50 });
    expect(l.cost).toBe(1000);
  });
});

describe("computeQuote", () => {
  const lines: QuoteLineInput[] = [
    line({ kind: "material", description: "Plata", quantity: 5, unit_cost: 2000, apply_metal_loss: true }),
    line({ kind: "labor", description: "Banco", quantity: 0.5, unit_cost: 10000, labor_type: "bench" }),
    line({ kind: "machine", scope: "per_batch", description: "Horno", quantity: 1, unit_cost: 3000 }),
    line({ kind: "one_time", description: "Diseño + master + molde", quantity: 1, unit_cost: 60000 }),
  ];

  it("adds sections, failure on recurring costs only, then margin on everything", () => {
    const b = computeQuote(lines, { quantity: 10, metal_loss_pct: 10, failure_pct: 10, margin_pct: 20, deposit_pct: 50 });
    expect(b.sections.materials).toBe(110000); // 5 g x 10 pcs x 1.1 x 2000
    expect(b.sections.labor).toBe(50000);
    expect(b.sections.machines).toBe(3000);
    expect(b.sections.one_time).toBe(60000);
    expect(b.subtotal).toBe(223000);
    expect(b.recurring_subtotal).toBe(163000);
    expect(b.failure_allowance).toBe(16300);
    expect(b.margin).toBe(47860); // (223000 + 16300) x 0.2
    expect(b.total).toBe(287160);
    expect(b.unit_price).toBe(28716);
    expect(b.one_time_per_unit).toBe(6000);
    expect(b.deposit).toBe(143580);
  });

  it("makes the unit price drop with quantity when there are one-time costs", () => {
    const params = { ...base, failure_pct: 10, margin_pct: 20 };
    const breaks = computePriceBreaks(lines, params, [1, 10, 50]);
    expect(breaks[0].unit_price).toBeGreaterThan(breaks[1].unit_price);
    expect(breaks[1].unit_price).toBeGreaterThan(breaks[2].unit_price);
  });

  it("treats quantity < 1 as 1", () => {
    const b = computeQuote(lines, { ...base, quantity: 0 });
    expect(b.quantity).toBe(1);
  });

  it("returns zeros for an empty quote", () => {
    const b = computeQuote([], base);
    expect(b.total).toBe(0);
    expect(b.unit_price).toBe(0);
  });
});

describe("parsePriceBreaks", () => {
  it("parses, dedupes, sorts, and drops the base quantity", () => {
    expect(parsePriceBreaks("50, 10;10 25 abc -3", 25)).toEqual([10, 50]);
    expect(parsePriceBreaks("", 1)).toEqual([]);
    expect(parsePriceBreaks(null)).toEqual([]);
  });
});

describe("machineRate", () => {
  it("adds wear, energy, and extras per use", () => {
    const r = machineRate({ purchase_price: 1200000, life_uses: 500, energy_kwh_per_use: 8, extra_cost_per_use: 100 }, 150);
    expect(r.wear).toBe(2400);
    expect(r.energy).toBe(1200);
    expect(r.extra).toBe(100);
    expect(r.rate).toBe(3700);
  });

  it("guards against zero life", () => {
    expect(machineRate({ purchase_price: 1000, life_uses: 0 }, 0).rate).toBe(1000);
  });
});

describe("applyPurchase", () => {
  it("computes a weighted average", () => {
    const s = applyPurchase({ stock_qty: 500, avg_cost: 60 }, 500, 80);
    expect(s.stock_qty).toBe(1000);
    expect(s.avg_cost).toBe(70);
  });

  it("uses the purchase price when stock is empty or negative", () => {
    expect(applyPurchase({ stock_qty: 0, avg_cost: 0 }, 100, 50)).toEqual({ stock_qty: 100, avg_cost: 50 });
    expect(applyPurchase({ stock_qty: -20, avg_cost: 40 }, 100, 50)).toEqual({ stock_qty: 80, avg_cost: 50 });
  });
});
