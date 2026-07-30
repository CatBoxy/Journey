// Pure treasury computation — no database access, fully testable.

export interface Expense {
  amount: number;
  currency: string;
  date: string;
  recurrence: string;  // 'none' | 'monthly' | 'yearly'
  is_capital: number;  // 0 | 1
  useful_life_months: number | null;
  fx_rate: number | null;
}

export interface Sale {
  amount: number;
  currency: string;
  date: string;
  fx_rate: number | null;
  product_id: number | null;
  unit_cost_at_sale: number | null;
}

export interface Contribution {
  amount: number;
  currency: string;
  fx_rate: number | null;
}

export interface Product {
  id: number;
  price: number | null;
  currency: string;
}

export interface ProductBom {
  product_id: number;
  material_cost: number;  // sum(quantity * unit_cost), same currency as product
}

export interface ProductWorkMinutes {
  product_id: number;
  total_minutes: number;
}

export interface Settings {
  default_currency?: string;
  current_fx_rate?: string;
  hourly_labor_rate?: string;
  transaction_fee_pct?: string;
  packaging_cost_per_sale?: string;
  shipping_cost_per_sale?: string;
}

export interface FxInfo {
  fx_basis: "per_record" | "settings_fallback" | "mixed";
  fallback_count: number;
}

export interface TreasuryResult {
  // Legacy fields — always present
  expenses_ars: number;
  expenses_usd: number;
  sales_ars: number;
  sales_usd: number;
  net_ars: number;
  net_usd: number;
  monthly_target_ars?: number;
  monthly_target_usd?: number;
  months?: number;

  // Capital
  capital_invested_ars: number;
  capital_invested_usd: number;
  cash_position_ars: number;
  cash_position_usd: number;

  // Normalized (in default_currency)
  default_currency: string;
  expenses_normalized: number;
  sales_normalized: number;
  contributions_normalized: number;
  net_normalized: number;
  cash_position_normalized: number;
  fx_info: FxInfo;

  // Break-even (ledger method)
  ledger?: {
    method: "ledger";
    fixed_monthly_cost: number;
    avg_monthly_variable: number;
    break_even_revenue_monthly: number;
    avg_monthly_revenue: number;
    months_covered: number;
    gap: number;
  };

  // Break-even (contribution margin) — added in Phase 3
  contribution_margin?: {
    method: "contribution_margin";
    mix_basis: "sales_weighted" | "unweighted_fallback";
    cash_only: {
      avg_unit_cost: number;
      avg_contribution_margin: number;
      contribution_margin_ratio: number;
      break_even_revenue_monthly: number | null;
      break_even_units_monthly: number | null;
    };
    full_cost: {
      avg_unit_cost: number;
      avg_contribution_margin: number;
      contribution_margin_ratio: number;
      break_even_revenue_monthly: number | null;
      break_even_units_monthly: number | null;
    };
  };
}

function toDefaultCurrency(
  amount: number,
  currency: string,
  fxRate: number | null,
  defaultCurrency: string,
  settingsFxRate: number | null,
): { normalized: number; usedFallback: boolean } | null {
  if (currency === defaultCurrency) {
    return { normalized: amount, usedFallback: false };
  }
  // We need to convert. ARS->USD: divide by rate. USD->ARS: multiply by rate.
  const rate = fxRate ?? settingsFxRate;
  if (rate == null || rate === 0) return null;

  if (defaultCurrency === "USD") {
    // amount is ARS, convert to USD
    return { normalized: amount / rate, usedFallback: fxRate == null };
  } else {
    // amount is USD, convert to ARS
    return { normalized: amount * rate, usedFallback: fxRate == null };
  }
}

function monthsBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

export function computeTreasury(
  expenses: Expense[],
  sales: Sale[],
  contributions: Contribution[],
  settings: Settings,
  now: Date,
  monthsParam?: number,
  // Phase 3 inputs — optional
  products?: Product[],
  productBoms?: ProductBom[],
  productWorkMinutes?: ProductWorkMinutes[],
): TreasuryResult {
  const defaultCurrency = settings.default_currency || "ARS";
  const settingsFxRate = settings.current_fx_rate ? Number(settings.current_fx_rate) : null;

  // ---- Per-currency totals (legacy) ----
  let expenses_ars = 0, expenses_usd = 0;
  for (const e of expenses) {
    if (e.currency === "ARS") expenses_ars += e.amount;
    else expenses_usd += e.amount;
  }
  let sales_ars = 0, sales_usd = 0;
  for (const s of sales) {
    if (s.currency === "ARS") sales_ars += s.amount;
    else sales_usd += s.amount;
  }
  let capital_invested_ars = 0, capital_invested_usd = 0;
  for (const c of contributions) {
    if (c.currency === "ARS") capital_invested_ars += c.amount;
    else capital_invested_usd += c.amount;
  }

  const net_ars = sales_ars - expenses_ars;
  const net_usd = sales_usd - expenses_usd;
  const cash_position_ars = capital_invested_ars + sales_ars - expenses_ars;
  const cash_position_usd = capital_invested_usd + sales_usd - expenses_usd;

  // ---- FX normalization ----
  let expenses_normalized = 0;
  let sales_normalized = 0;
  let contributions_normalized = 0;
  let fallback_count = 0;
  let perRecordCount = 0;
  let totalRecords = 0;

  for (const e of expenses) {
    totalRecords++;
    const conv = toDefaultCurrency(e.amount, e.currency, e.fx_rate, defaultCurrency, settingsFxRate);
    if (conv) {
      expenses_normalized += conv.normalized;
      if (conv.usedFallback) fallback_count++;
      else perRecordCount++;
    } else {
      // No rate available — use amount as-is (same currency assumed)
      expenses_normalized += e.amount;
    }
  }
  for (const s of sales) {
    totalRecords++;
    const conv = toDefaultCurrency(s.amount, s.currency, s.fx_rate, defaultCurrency, settingsFxRate);
    if (conv) {
      sales_normalized += conv.normalized;
      if (conv.usedFallback) fallback_count++;
      else perRecordCount++;
    } else {
      sales_normalized += s.amount;
    }
  }
  for (const c of contributions) {
    totalRecords++;
    const conv = toDefaultCurrency(c.amount, c.currency, c.fx_rate, defaultCurrency, settingsFxRate);
    if (conv) {
      contributions_normalized += conv.normalized;
      if (conv.usedFallback) fallback_count++;
      else perRecordCount++;
    } else {
      contributions_normalized += c.amount;
    }
  }

  let fx_basis: FxInfo["fx_basis"];
  if (fallback_count === 0) fx_basis = "per_record";
  else if (perRecordCount === 0) fx_basis = "settings_fallback";
  else fx_basis = "mixed";

  const net_normalized = sales_normalized - expenses_normalized;
  const cash_position_normalized = contributions_normalized + sales_normalized - expenses_normalized;

  // ---- Legacy monthly target ----
  const result: TreasuryResult = {
    expenses_ars, expenses_usd,
    sales_ars, sales_usd,
    net_ars, net_usd,
    capital_invested_ars, capital_invested_usd,
    cash_position_ars, cash_position_usd,
    default_currency: defaultCurrency,
    expenses_normalized,
    sales_normalized,
    contributions_normalized,
    net_normalized,
    cash_position_normalized,
    fx_info: { fx_basis, fallback_count },
  };

  if (monthsParam && monthsParam > 0) {
    result.monthly_target_ars = net_ars < 0 ? Math.abs(net_ars) / monthsParam : 0;
    result.monthly_target_usd = net_usd < 0 ? Math.abs(net_usd) / monthsParam : 0;
    result.months = monthsParam;
  }

  // ---- Ledger break-even ----
  result.ledger = computeLedgerBreakEven(expenses, sales, now, defaultCurrency, settingsFxRate);

  // ---- Contribution margin (Phase 3) ----
  if (products && productBoms && productWorkMinutes) {
    const cm = computeContributionMarginBreakEven(
      expenses, sales, products, productBoms, productWorkMinutes,
      settings, now, defaultCurrency, settingsFxRate,
    );
    if (cm) result.contribution_margin = cm;
  }

  return result;
}

function normalizeAmount(
  amount: number,
  currency: string,
  fxRate: number | null,
  defaultCurrency: string,
  settingsFxRate: number | null,
): number {
  const conv = toDefaultCurrency(amount, currency, fxRate, defaultCurrency, settingsFxRate);
  return conv ? conv.normalized : amount;
}

export function computeLedgerBreakEven(
  expenses: Expense[],
  sales: Sale[],
  now: Date,
  defaultCurrency: string,
  settingsFxRate: number | null,
): TreasuryResult["ledger"] {
  let fixedMonthly = 0;

  for (const e of expenses) {
    const amt = normalizeAmount(e.amount, e.currency, e.fx_rate, defaultCurrency, settingsFxRate);
    if (e.recurrence === "monthly") {
      fixedMonthly += amt;
    } else if (e.recurrence === "yearly") {
      fixedMonthly += amt / 12;
    } else if (e.is_capital && e.useful_life_months && e.useful_life_months > 0) {
      // Only count if still within useful life
      const monthsElapsed = monthsBetween(e.date, now);
      if (monthsElapsed < e.useful_life_months) {
        fixedMonthly += amt / e.useful_life_months;
      }
    }
  }

  // Variable expenses: non-recurring, non-capital, normalized
  const variableByMonth = new Map<string, number>();
  for (const e of expenses) {
    if (e.recurrence !== "none" || e.is_capital) continue;
    const month = e.date.substring(0, 7); // YYYY-MM
    const amt = normalizeAmount(e.amount, e.currency, e.fx_rate, defaultCurrency, settingsFxRate);
    variableByMonth.set(month, (variableByMonth.get(month) || 0) + amt);
  }

  const monthlyVariableValues = Array.from(variableByMonth.values());
  const monthsCovered = monthlyVariableValues.length;
  const avgMonthlyVariable = monthsCovered > 0
    ? monthlyVariableValues.reduce((a, b) => a + b, 0) / monthsCovered
    : 0;

  // Revenue by month
  const revenueByMonth = new Map<string, number>();
  for (const s of sales) {
    const month = s.date.substring(0, 7);
    const amt = normalizeAmount(s.amount, s.currency, s.fx_rate, defaultCurrency, settingsFxRate);
    revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + amt);
  }

  const monthlyRevenueValues = Array.from(revenueByMonth.values());
  const revenueMonths = monthlyRevenueValues.length;
  const avgMonthlyRevenue = revenueMonths > 0
    ? monthlyRevenueValues.reduce((a, b) => a + b, 0) / revenueMonths
    : 0;

  const breakEven = fixedMonthly + avgMonthlyVariable;

  return {
    method: "ledger",
    fixed_monthly_cost: round2(fixedMonthly),
    avg_monthly_variable: round2(avgMonthlyVariable),
    break_even_revenue_monthly: round2(breakEven),
    avg_monthly_revenue: round2(avgMonthlyRevenue),
    months_covered: Math.max(monthsCovered, revenueMonths),
    gap: round2(breakEven - avgMonthlyRevenue),
  };
}

export function computeContributionMarginBreakEven(
  expenses: Expense[],
  sales: Sale[],
  products: Product[],
  productBoms: ProductBom[],
  productWorkMinutes: ProductWorkMinutes[],
  settings: Settings,
  now: Date,
  defaultCurrency: string,
  settingsFxRate: number | null,
): TreasuryResult["contribution_margin"] | null {
  const hourlyRate = settings.hourly_labor_rate ? Number(settings.hourly_labor_rate) : 0;
  const txFeePct = settings.transaction_fee_pct ? Number(settings.transaction_fee_pct) / 100 : 0;
  const packagingCost = settings.packaging_cost_per_sale ? Number(settings.packaging_cost_per_sale) : 0;
  const shippingCost = settings.shipping_cost_per_sale ? Number(settings.shipping_cost_per_sale) : 0;

  // Only products with both a price and a BOM
  const bomMap = new Map(productBoms.map(b => [b.product_id, b.material_cost]));
  const minutesMap = new Map(productWorkMinutes.map(w => [w.product_id, w.total_minutes]));
  const eligibleProducts = products.filter(p => p.price != null && p.price > 0 && bomMap.has(p.id));

  if (eligibleProducts.length === 0) return null;

  // Sales weighting: count units sold per product in the lookback window
  const salesCountByProduct = new Map<number, number>();
  for (const s of sales) {
    if (s.product_id != null) {
      salesCountByProduct.set(s.product_id, (salesCountByProduct.get(s.product_id) || 0) + 1);
    }
  }

  const hasSalesHistory = eligibleProducts.some(p => (salesCountByProduct.get(p.id) || 0) > 0);
  const mixBasis: "sales_weighted" | "unweighted_fallback" = hasSalesHistory ? "sales_weighted" : "unweighted_fallback";

  function computeForCostMode(includeLaborCost: boolean) {
    let weightedUnitCostSum = 0;
    let weightedMarginSum = 0;
    let weightedPriceSum = 0;
    let totalWeight = 0;

    for (const p of eligibleProducts) {
      const price = normalizeAmount(p.price!, p.currency, null, defaultCurrency, settingsFxRate);
      const materialCost = bomMap.get(p.id) || 0;
      const minutes = minutesMap.get(p.id) || 0;
      const laborCost = includeLaborCost ? (minutes / 60) * hourlyRate : 0;
      const unitCost = materialCost + laborCost + packagingCost + shippingCost + (txFeePct * price);
      const margin = price - unitCost;

      const weight = mixBasis === "sales_weighted" ? (salesCountByProduct.get(p.id) || 0) : 1;
      if (weight === 0 && mixBasis === "sales_weighted") continue;

      weightedUnitCostSum += unitCost * weight;
      weightedMarginSum += margin * weight;
      weightedPriceSum += price * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return { avg_unit_cost: 0, avg_contribution_margin: 0, contribution_margin_ratio: 0, break_even_revenue_monthly: null, break_even_units_monthly: null };
    }

    const avgUnitCost = weightedUnitCostSum / totalWeight;
    const avgMargin = weightedMarginSum / totalWeight;
    const avgPrice = weightedPriceSum / totalWeight;
    const marginRatio = avgPrice > 0 ? avgMargin / avgPrice : 0;

    // Use ledger fixed cost for break-even
    const ledger = computeLedgerBreakEven(expenses, sales, now, defaultCurrency, settingsFxRate);
    const fixedMonthly = ledger ? ledger.fixed_monthly_cost : 0;

    const breakEvenRevenue = marginRatio > 0 ? fixedMonthly / marginRatio : null;
    const breakEvenUnits = avgMargin > 0 ? fixedMonthly / avgMargin : null;

    return {
      avg_unit_cost: round2(avgUnitCost),
      avg_contribution_margin: round2(avgMargin),
      contribution_margin_ratio: round4(marginRatio),
      break_even_revenue_monthly: breakEvenRevenue != null ? round2(breakEvenRevenue) : null,
      break_even_units_monthly: breakEvenUnits != null ? round2(breakEvenUnits) : null,
    };
  }

  return {
    method: "contribution_margin",
    mix_basis: mixBasis,
    cash_only: computeForCostMode(false),
    full_cost: computeForCostMode(true),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
