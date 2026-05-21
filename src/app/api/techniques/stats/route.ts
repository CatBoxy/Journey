import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const techniqueId = searchParams.get("techniqueId");
  if (!techniqueId) {
    return Response.json({ error: "techniqueId is required" }, { status: 400 });
  }

  const result = await execute(
    `SELECT
       COALESCE(SUM(minutes_spent), 0) as total_minutes,
       COUNT(*) as entry_count,
       MIN(created_at) as first_entry,
       MAX(created_at) as last_entry
     FROM technique_entries
     WHERE technique_id = ?`,
    [techniqueId]
  );

  // Monthly breakdown
  const monthly = await execute(
    `SELECT
       strftime('%Y-%m', created_at) as month,
       COALESCE(SUM(minutes_spent), 0) as minutes,
       COUNT(*) as entries
     FROM technique_entries
     WHERE technique_id = ?
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month DESC`,
    [techniqueId]
  );

  const stats = result.rows[0];
  return Response.json({
    total_minutes: stats.total_minutes,
    entry_count: stats.entry_count,
    first_entry: stats.first_entry,
    last_entry: stats.last_entry,
    monthly: monthly.rows,
  });
}
