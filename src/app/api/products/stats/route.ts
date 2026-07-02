import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 });
  }

  const result = await execute(
    `SELECT
       COALESCE(SUM(minutes_spent), 0) as total_minutes,
       COUNT(*) as total_entry_count,
       COUNT(minutes_spent) as tracked_entry_count,
       MIN(created_at) as first_entry,
       MAX(created_at) as last_entry
     FROM product_work_entries
     WHERE product_id = ?`,
    [productId]
  );

  const stats = result.rows[0];
  return Response.json({
    total_minutes: stats.total_minutes,
    total_entry_count: stats.total_entry_count,
    tracked_entry_count: stats.tracked_entry_count,
    first_entry: stats.first_entry,
    last_entry: stats.last_entry,
  });
}
