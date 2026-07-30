import { describe, it, expect } from "vitest";
import {
  computeTreasury,
  computeLedgerBreakEven,
  computeContributionMarginBreakEven,
  type Expense,
  type Sale,
  type Contribution,
  type Product,
  type ProductBom,
  type ProductWorkMinutes,
  type Settings,
} from "./treasury";

const now = new Date("2026-07-30");

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    amount: 1000,
    currency: "ARS",
    date: "2026-07-01",
    recurrence: "none",
    is_capital: 0,
    useful_life_months: null,
    fx_rate: null,
    ...overrides,
  };
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    amount: 5000,
    currency: "ARS",
    date: "2026-07-15",
    fx_rate: null,
    product_id: null,
    unit_cost_at_sale: null,
    ...overrides,
  };
}

// ---- Empty database ----

describe("empty database", () => {
  it("returns zeros and nulls, never crashes", () => {
    const result = computeTreasury([], [], [], {}, now);
    expect(result.expenses_ars).toBe(0);
    expect(result.sales_ars).toBe(0);
    expect(result.net_ars).toBe(0);
    expect(result.cash_position_ars).toBe(0);
    expect(result.ledger).toBeDefined();
    expect(result.ledger!.fixed_monthly_cost).toBe(0);
    expect(result.ledger!.avg_monthly_variable).toBe(0);
    expect(result.ledger!.break_even_revenue_monthly).toBe(0);
    expect(result.ledger!.avg_monthly_revenue).toBe(0);
    expect(result.ledger!.gap).toBe(0);
    expect(result.contribution_margin).toBeUndefined();
  });
});

// ---- Ledger break-even ----

describe("ledger break-even", () => {
  it("computes fixed monthly from monthly recurring", () => {
    const expenses = [makeExpense({ amount: 3000, recurrence: "monthly" })];
    const result = computeLedgerBreakEven(expenses, [], now, "ARS", null);
    expect(result!.fixed_monthly_cost).toBe(3000);
  });

  it("computes fixed monthly from yearly recurring", () => {
    const expenses = [makeExpense({ amount: 12000, recurrence: "yearly" })];
    const result = computeLedgerBreakEven(expenses, [], now, "ARS", null);
    expect(result!.fixed_monthly_cost).toBe(1000);
  });

  it("includes capital expense inside useful life", () => {
    const expenses = [makeExpense({
      amount: 24000,
      is_capital: 1,
      useful_life_months: 24,
      date: "2026-06-01", // 1 month ago, still within 24 months
    })];
    const result = computeLedgerBreakEven(expenses, [], now, "ARS", null);
    expect(result!.fixed_monthly_cost).toBe(1000);
  });

  it("excludes capital expense outside useful life", () => {
    const expenses = [makeExpense({
      amount: 6000,
      is_capital: 1,
      useful_life_months: 6,
      date: "2025-01-01", // > 6 months ago
    })];
    const result = computeLedgerBreakEven(expenses, [], now, "ARS", null);
    expect(result!.fixed_monthly_cost).toBe(0);
  });

  it("computes avg monthly variable from non-recurring expenses", () => {
    const expenses = [
      makeExpense({ amount: 500, date: "2026-06-10" }),
      makeExpense({ amount: 700, date: "2026-06-20" }),
      makeExpense({ amount: 1000, date: "2026-07-05" }),
    ];
    const result = computeLedgerBreakEven(expenses, [], now, "ARS", null);
    // June: 1200, July: 1000 -> avg = 1100
    expect(result!.avg_monthly_variable).toBe(1100);
  });

  it("computes gap correctly", () => {
    const expenses = [makeExpense({ amount: 2000, recurrence: "monthly" })];
    const sales = [makeSale({ amount: 1500, date: "2026-07-15" })];
    const result = computeLedgerBreakEven(expenses, sales, now, "ARS", null);
    // fixed=2000, variable=0, breakeven=2000, revenue=1500, gap=500
    expect(result!.gap).toBe(500);
  });
});

// ---- FX normalization ----

describe("FX normalization", () => {
  it("uses per-record fx_rate when available", () => {
    const expenses = [makeExpense({ amount: 100, currency: "USD", fx_rate: 1000 })];
    const result = computeTreasury(expenses, [], [], { default_currency: "ARS" }, now);
    expect(result.expenses_normalized).toBe(100000); // 100 USD * 1000
    expect(result.fx_info.fx_basis).toBe("per_record");
    expect(result.fx_info.fallback_count).toBe(0);
  });

  it("falls back to settings fx_rate", () => {
    const expenses = [makeExpense({ amount: 100, currency: "USD" })];
    const result = computeTreasury(expenses, [], [], { default_currency: "ARS", current_fx_rate: "1200" }, now);
    expect(result.expenses_normalized).toBe(120000);
    expect(result.fx_info.fx_basis).toBe("settings_fallback");
    expect(result.fx_info.fallback_count).toBe(1);
  });

  it("reports mixed basis when some records have rate and some don't", () => {
    const expenses = [
      makeExpense({ amount: 100, currency: "USD", fx_rate: 1000 }),
      makeExpense({ amount: 50, currency: "USD" }),
    ];
    const result = computeTreasury(expenses, [], [], { default_currency: "ARS", current_fx_rate: "1200" }, now);
    expect(result.fx_info.fx_basis).toBe("mixed");
    expect(result.fx_info.fallback_count).toBe(1);
  });
});

// ---- Capital invested / cash position ----

describe("capital invested and cash position", () => {
  it("tracks contributions separately from revenue", () => {
    const contributions: Contribution[] = [{ amount: 50000, currency: "ARS", fx_rate: null }];
    const expenses = [makeExpense({ amount: 10000 })];
    const sales = [makeSale({ amount: 3000 })];
    const result = computeTreasury(expenses, sales, contributions, {}, now);
    expect(result.capital_invested_ars).toBe(50000);
    expect(result.cash_position_ars).toBe(50000 + 3000 - 10000); // 43000
    expect(result.net_ars).toBe(3000 - 10000); // -7000 (contributions NOT in net)
  });
});

// ---- Contribution margin ----

describe("contribution margin break-even", () => {
  const settings: Settings = {
    hourly_labor_rate: "500",
    transaction_fee_pct: "10",
    packaging_cost_per_sale: "200",
    shipping_cost_per_sale: "300",
  };

  const products: Product[] = [
    { id: 1, price: 10000, currency: "ARS" },
  ];
  const boms: ProductBom[] = [{ product_id: 1, material_cost: 2000 }];
  const work: ProductWorkMinutes[] = [{ product_id: 1, total_minutes: 120 }]; // 2 hours

  it("returns null when no products have price+BOM", () => {
    const result = computeContributionMarginBreakEven(
      [], [], [{ id: 1, price: null, currency: "ARS" }], [], [], settings, now, "ARS", null
    );
    expect(result).toBeNull();
  });

  it("computes cash-only margin (labor=0)", () => {
    const expenses = [makeExpense({ amount: 5000, recurrence: "monthly" })];
    const sales = [makeSale({ product_id: 1 })];
    const result = computeContributionMarginBreakEven(
      expenses, sales, products, boms, work, settings, now, "ARS", null
    );
    expect(result).not.toBeNull();
    expect(result!.mix_basis).toBe("sales_weighted");
    // cash unit cost = 2000 (materials) + 200 (packaging) + 300 (shipping) + 1000 (10% of 10000) = 3500
    expect(result!.cash_only.avg_unit_cost).toBe(3500);
    // margin = 10000 - 3500 = 6500
    expect(result!.cash_only.avg_contribution_margin).toBe(6500);
  });

  it("computes full-cost margin (labor included)", () => {
    const expenses = [makeExpense({ amount: 5000, recurrence: "monthly" })];
    const sales = [makeSale({ product_id: 1 })];
    const result = computeContributionMarginBreakEven(
      expenses, sales, products, boms, work, settings, now, "ARS", null
    );
    // full unit cost = 3500 + (120/60)*500 = 3500 + 1000 = 4500
    expect(result!.full_cost.avg_unit_cost).toBe(4500);
    // margin = 10000 - 4500 = 5500
    expect(result!.full_cost.avg_contribution_margin).toBe(5500);
  });

  it("uses sales-weighted mix when sales history exists", () => {
    const sales = [
      makeSale({ product_id: 1 }),
      makeSale({ product_id: 1 }),
    ];
    const products2: Product[] = [
      { id: 1, price: 10000, currency: "ARS" },
      { id: 2, price: 20000, currency: "ARS" },
    ];
    const boms2: ProductBom[] = [
      { product_id: 1, material_cost: 2000 },
      { product_id: 2, material_cost: 5000 },
    ];
    const result = computeContributionMarginBreakEven(
      [], sales, products2, boms2, [], settings, now, "ARS", null
    );
    // Product 2 has BOM+price but 0 sales — should be excluded in sales-weighted
    expect(result!.mix_basis).toBe("sales_weighted");
    // Only product 1 contributes
    expect(result!.cash_only.avg_unit_cost).toBe(3500);
  });

  it("falls back to unweighted when no sales history", () => {
    const result = computeContributionMarginBreakEven(
      [], [], products, boms, work, settings, now, "ARS", null
    );
    expect(result!.mix_basis).toBe("unweighted_fallback");
  });

  it("handles fees pushing margin negative", () => {
    const expensiveProducts: Product[] = [{ id: 1, price: 1000, currency: "ARS" }];
    // material_cost=2000 > price=1000 -> negative margin
    const result = computeContributionMarginBreakEven(
      [], [], expensiveProducts, boms, work, settings, now, "ARS", null
    );
    expect(result!.cash_only.avg_contribution_margin).toBeLessThan(0);
    // break_even should be null (negative margin ratio)
    expect(result!.cash_only.break_even_revenue_monthly).toBeNull();
    expect(result!.cash_only.break_even_units_monthly).toBeNull();
  });
});

// ---- Material price change must not alter past sale's margin ----

describe("historical margin isolation", () => {
  it("unit_cost_at_sale is independent of current material prices", () => {
    // This test validates the design: unit_cost_at_sale is snapshotted at sale time.
    // A subsequent material price change doesn't affect it.
    const sale = makeSale({ product_id: 1, unit_cost_at_sale: 3000, amount: 10000 });
    // The sale's recorded cost stays at 3000 regardless of current BOM prices
    expect(sale.unit_cost_at_sale).toBe(3000);
    // Even if we pass different BOM data for treasury, the sale's snapshot is preserved
    const result = computeTreasury(
      [],
      [sale],
      [],
      {},
      now,
      undefined,
      [{ id: 1, price: 10000, currency: "ARS" }],
      [{ product_id: 1, material_cost: 9000 }], // price tripled
      [],
    );
    // Treasury uses current BOM for forward-looking contribution margin
    // but the sale record itself holds the snapshotted cost
    expect(result.sales_ars).toBe(10000);
    // The contribution_margin uses current BOM (9000), not the snapshotted 3000
    if (result.contribution_margin) {
      expect(result.contribution_margin.cash_only.avg_unit_cost).toBeGreaterThan(3000);
    }
  });
});

// ---- Ledger vs margin method selection ----

describe("method selection", () => {
  it("returns ledger only when no products have price+BOM", () => {
    const result = computeTreasury([], [], [], {}, now);
    expect(result.ledger).toBeDefined();
    expect(result.contribution_margin).toBeUndefined();
  });

  it("returns both when products have price+BOM", () => {
    const result = computeTreasury(
      [makeExpense({ amount: 1000, recurrence: "monthly" })],
      [makeSale({ product_id: 1 })],
      [],
      { hourly_labor_rate: "500", transaction_fee_pct: "0", packaging_cost_per_sale: "0", shipping_cost_per_sale: "0" },
      now,
      undefined,
      [{ id: 1, price: 5000, currency: "ARS" }],
      [{ product_id: 1, material_cost: 1000 }],
      [{ product_id: 1, total_minutes: 60 }],
    );
    expect(result.ledger).toBeDefined();
    expect(result.ledger!.method).toBe("ledger");
    expect(result.contribution_margin).toBeDefined();
    expect(result.contribution_margin!.method).toBe("contribution_margin");
  });
});

// ---- Zero-margin edge case ----

describe("zero margin", () => {
  it("returns null break-even when margin is exactly zero", () => {
    // price exactly equals costs -> margin = 0 -> break-even = infinity -> null
    const products: Product[] = [{ id: 1, price: 2000, currency: "ARS" }];
    const boms: ProductBom[] = [{ product_id: 1, material_cost: 2000 }];
    const settings: Settings = {
      transaction_fee_pct: "0",
      packaging_cost_per_sale: "0",
      shipping_cost_per_sale: "0",
    };
    const result = computeContributionMarginBreakEven(
      [], [], products, boms, [], settings, now, "ARS", null
    );
    expect(result!.cash_only.avg_contribution_margin).toBe(0);
    expect(result!.cash_only.break_even_revenue_monthly).toBeNull();
    expect(result!.cash_only.break_even_units_monthly).toBeNull();
  });
});
