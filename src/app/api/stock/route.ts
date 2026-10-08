import { NextRequest } from "next/server";
import { countStock, errorResponse, listMovements, recordPurchase, recordUsage } from "@/lib/workshop";

// GET /api/stock?material_id=1  -> stock movements (all materials if omitted)
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("material_id");
    return Response.json(await listMovements(id ? Number(id) : undefined));
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/stock
//   { action: "purchase", material_id, quantity, total_price, currency?, fx_rate?, date?, notes?, create_expense? }
//   { action: "use", material_id, type: "job" | "rnd" | "adjustment", quantity, quote_id?, date?, notes? }
//   { action: "count", material_id, counted_qty, as_rnd?, notes? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...rest } = body;
    if (!rest.material_id) return Response.json({ error: "material_id is required" }, { status: 400 });
    if (action === "purchase") return Response.json(await recordPurchase(rest), { status: 201 });
    if (action === "use") return Response.json(await recordUsage(rest), { status: 201 });
    if (action === "count") return Response.json(await countStock(rest), { status: 201 });
    return Response.json({ error: "action must be purchase, use, or count" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
