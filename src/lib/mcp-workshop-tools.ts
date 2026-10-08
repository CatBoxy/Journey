// MCP tools for stock, machines, and presupuestos. Registered on the remote
// MCP server (src/app/mcp/route.ts). All logic lives in @/lib/workshop.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ValidationError,
  countStock,
  createMachine,
  createQuote,
  deleteQuote,
  getQuote,
  listMachines,
  listMovements,
  listQuotes,
  recordPurchase,
  recordUsage,
  repriceQuote,
  rndSummary,
  updateMachine,
  updateQuote,
  QUOTE_STATUSES,
} from "@/lib/workshop";

function ok(data: unknown, prefix = "") {
  return { content: [{ type: "text" as const, text: `${prefix}${JSON.stringify(data, null, 2)}` }] };
}

async function run(fn: () => Promise<unknown>, prefix = "") {
  try {
    return ok(await fn(), prefix);
  } catch (e) {
    const msg = e instanceof ValidationError || e instanceof Error ? e.message : "Unknown error";
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
}

const quoteLine = z.object({
  kind: z.enum(["material", "labor", "machine", "one_time", "other"]).describe(
    "material = stock item or metal; labor = hours of work; machine = machine uses; one_time = design/master/mold, charged once; other = anything else"
  ),
  scope: z.enum(["per_piece", "per_batch"]).optional().describe(
    "per_piece multiplies by the quote quantity (default for everything except machines); per_batch is charged once (default for machines)"
  ),
  description: z.string().optional().describe("Shown on the PDF. Filled from the material/machine name if omitted"),
  quantity: z.number().describe("Grams/ml/units of material, hours of labor, machine uses (hours or cycles), or 1 for a fixed cost"),
  unit: z.string().optional(),
  unit_cost: z.number().optional().describe("ARS per unit. Omit to use the current price: stock average, labor rate, or machine rate. Required for metals unless silver_price_per_g is given"),
  material_id: z.number().optional(),
  machine_id: z.number().optional(),
  labor_type: z.enum(["design", "bench"]).optional().describe("For labor lines: design (CAD) or bench work. Uses labor_rate_design / labor_rate_bench"),
  apply_metal_loss: z.boolean().optional().describe("Add the quote's metal loss % to this line. Defaults to true for metal materials"),
});

const quoteFields = {
  title: z.string().optional().describe("What the job is, e.g. 'Anillos de compromiso x2' or 'Serie 50 dijes'"),
  client_name: z.string().optional(),
  client_contact: z.string().optional(),
  description: z.string().optional().describe("Shown on the PDF under the title"),
  quantity: z.number().optional().describe("Number of pieces (default 1)"),
  status: z.enum(QUOTE_STATUSES).optional(),
  date: z.string().optional().describe("YYYY-MM-DD, default today"),
  valid_until: z.string().optional().describe("YYYY-MM-DD, default date + quote_validity_days"),
  metal_loss_pct: z.number().optional(),
  failure_pct: z.number().optional().describe("Allowance for failed casts/reprints, % of costs excluding one-time costs"),
  margin_pct: z.number().optional().describe("Profit margin %, applied on top of costs + failure allowance"),
  deposit_pct: z.number().optional(),
  price_breaks: z.string().optional().describe("Other quantities to price on the PDF, comma-separated, e.g. '10,25,50'"),
  notes: z.string().optional().describe("Terms shown on the PDF (delivery time, what's included)"),
  internal_notes: z.string().optional().describe("Not shown on the PDF"),
  silver_price_per_g: z.number().optional().describe("Today's replacement price per gram for metal lines without unit_cost. Ask the user for it on every new quote"),
};

export function registerWorkshopTools(server: McpServer) {
  // ---- Stock ----

  server.registerTool("record_purchase", {
    description: "Log a supply purchase: adds to stock, recalculates the weighted average cost, and records the expense (unless create_expense is false). Create the material first with add_material if it doesn't exist.",
    inputSchema: {
      material_id: z.number(),
      quantity: z.number().describe("Amount bought, in the material's unit (g, ml, unit, cm)"),
      total_price: z.number().describe("Total paid for this quantity"),
      currency: z.enum(["ARS", "USD"]).optional().describe("Currency paid (default: the material's currency)"),
      fx_rate: z.number().optional().describe("ARS per USD, needed if paid in a different currency than the material"),
      date: z.string().optional().describe("YYYY-MM-DD, default today"),
      notes: z.string().optional(),
      create_expense: z.boolean().optional().describe("Default true. Set false if the expense was already logged (e.g. it came inside a kit)"),
    },
  }, async (args) => run(() => recordPurchase(args), "Recorded: "));

  server.registerTool("record_material_use", {
    description: "Take material out of stock, valued at the current average cost. type: job (a client job, link quote_id if any), rnd (experiments and internal work, absorbed as R&D cost), adjustment (signed correction: negative = lost/spilled, positive = found).",
    inputSchema: {
      material_id: z.number(),
      type: z.enum(["job", "rnd", "adjustment"]),
      quantity: z.number().describe("Amount used (positive) for job/rnd; signed change for adjustment"),
      quote_id: z.number().optional(),
      date: z.string().optional(),
      notes: z.string().optional(),
    },
  }, async (args) => run(() => recordUsage(args), "Recorded: "));

  server.registerTool("count_stock", {
    description: "Set a material's stock to a counted/weighed amount. The difference is logged as an adjustment, or as R&D use if as_rnd is true.",
    inputSchema: {
      material_id: z.number(),
      counted_qty: z.number(),
      as_rnd: z.boolean().optional(),
      notes: z.string().optional(),
    },
  }, async (args) => run(() => countStock(args), "Counted: "));

  server.registerTool("list_stock_movements", {
    description: "List stock movements (purchases, job use, R&D use, adjustments), newest first",
    inputSchema: { material_id: z.number().optional() },
  }, async ({ material_id }) => run(() => listMovements(material_id)));

  server.registerTool("get_rnd_costs", {
    description: "Absorbed R&D material cost per month and per material",
    inputSchema: {},
  }, async () => run(() => rndSummary()));

  // ---- Machines ----

  server.registerTool("list_machines", {
    description: "List machines with their cost per use (rate = wear + energy + extras). Wear = purchase_price / life_uses; energy uses the electricity_kwh_price setting.",
    inputSchema: { include_inactive: z.boolean().optional() },
  }, async ({ include_inactive }) => run(() => listMachines(!!include_inactive)));

  const machineFields = {
    name: z.string().optional(),
    equipment_id: z.number().optional().describe("Linked equipment item, if any"),
    purchase_price: z.number().optional(),
    currency: z.enum(["ARS", "USD"]).optional(),
    usage_unit: z.enum(["hour", "cycle"]).optional().describe("Charge per hour (printer, injector) or per cycle (kiln burnout, vulcanized mold, melt)"),
    life_uses: z.number().optional().describe("Expected total hours or cycles over the machine's life"),
    energy_kwh_per_use: z.number().optional(),
    extra_cost_per_use: z.number().optional().describe("ARS per use for gas, LCD screen wear, crucible wear, etc."),
    notes: z.string().optional(),
  };

  server.registerTool("add_machine", {
    description: "Add a machine whose use is charged in presupuestos",
    inputSchema: { ...machineFields, name: z.string() },
  }, async (args) => run(() => createMachine(args), "Created: "));

  server.registerTool("update_machine", {
    description: "Update a machine. Only fields you include change.",
    inputSchema: { id: z.number(), ...machineFields, active: z.boolean().optional() },
  }, async ({ id, ...data }) => run(() => updateMachine(id, data), "Updated: "));

  // ---- Quotes ----

  server.registerTool("list_quotes", {
    description: "List presupuestos (quotes), newest first, optionally by status",
    inputSchema: { status: z.enum(QUOTE_STATUSES).optional() },
  }, async ({ status }) => run(() => listQuotes(status)));

  server.registerTool("get_quote", {
    description: "Get a presupuesto with its lines, cost breakdown (sections, failure allowance, margin, total, unit price, deposit) and price breaks. The PDF is at /api/quotes/pdf?id=<id> in the Journey app.",
    inputSchema: { id: z.number() },
  }, async ({ id }) => run(() => getQuote(id)));

  server.registerTool("create_quote", {
    description: "Create a presupuesto. Before calling, ask the user for today's silver replacement price if the job uses metal. Defaults for loss/failure/margin/deposit/validity come from settings. Typical lines: metal (material, grams per piece), resin/wax/investment (material), design hours (labor design, one_time if it's a one-off) or bench hours (labor bench, per piece), printer hours / kiln cycles / vulcanized mold (machine), rubber mold or master (one_time).",
    inputSchema: { ...quoteFields, title: z.string(), lines: z.array(quoteLine) },
  }, async ({ lines, ...data }) => run(() => createQuote(data, lines), "Created: "));

  server.registerTool("update_quote", {
    description: "Update a presupuesto. Use status to mark it sent/accepted/rejected/expired. If lines are given they replace all existing lines.",
    inputSchema: { id: z.number(), ...quoteFields, lines: z.array(quoteLine).optional() },
  }, async ({ id, lines, ...data }) => run(() => updateQuote(id, data, lines), "Updated: "));

  server.registerTool("reprice_quote", {
    description: "Refresh a presupuesto's prices to today's stock averages, labor rates, and machine rates. Metal lines keep their price unless silver_price_per_g is given.",
    inputSchema: { id: z.number(), silver_price_per_g: z.number().optional() },
  }, async ({ id, silver_price_per_g }) => run(() => repriceQuote(id, silver_price_per_g), "Repriced: "));

  server.registerTool("delete_quote", {
    description: "Delete a presupuesto and its lines",
    inputSchema: { id: z.number() },
  }, async ({ id }) => run(async () => { await deleteQuote(id); return { deleted: id }; }));
}
