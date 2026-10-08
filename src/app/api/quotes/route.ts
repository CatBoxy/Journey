import { NextRequest } from "next/server";
import { createQuote, deleteQuote, errorResponse, getQuote, listQuotes, repriceQuote, updateQuote } from "@/lib/workshop";

// GET /api/quotes            -> list (optional ?status=)
// GET /api/quotes?id=3       -> one quote with lines, breakdown, and price breaks
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) return Response.json(await getQuote(Number(id)));
    return Response.json(await listQuotes(request.nextUrl.searchParams.get("status") || undefined));
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/quotes { title, quantity, ..., silver_price_per_g?, lines: [...] }
export async function POST(request: NextRequest) {
  try {
    const { lines, ...data } = await request.json();
    return Response.json(await createQuote(data, lines || []), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

// PUT /api/quotes { id, ...fields, lines? }       -> update (lines replace all lines)
// PUT /api/quotes { id, reprice: true, silver_price_per_g? } -> refresh prices to today
export async function PUT(request: NextRequest) {
  try {
    const { id, lines, reprice, ...data } = await request.json();
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    if (reprice) return Response.json(await repriceQuote(Number(id), data.silver_price_per_g));
    return Response.json(await updateQuote(Number(id), data, lines));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    await deleteQuote(Number(id));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
