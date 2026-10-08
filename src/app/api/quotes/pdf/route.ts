import { NextRequest } from "next/server";
import { errorResponse, getQuote, getSettings } from "@/lib/workshop";
import { buildQuotePdf } from "@/lib/quote-pdf";

// GET /api/quotes/pdf?id=3  -> presupuesto PDF (add &download=1 to force download)
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    const full = await getQuote(Number(id));
    const bytes = await buildQuotePdf(full, await getSettings());
    const name = `Presupuesto-${full.quote.number}.pdf`;
    const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
