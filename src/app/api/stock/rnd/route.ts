import { errorResponse, rndSummary } from "@/lib/workshop";

// GET /api/stock/rnd -> absorbed R&D material cost per month and per material
export async function GET() {
  try {
    return Response.json(await rndSummary());
  } catch (e) {
    return errorResponse(e);
  }
}
