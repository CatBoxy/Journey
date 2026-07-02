import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const months = searchParams.get("months");

  const expenseResult = await execute(
    `SELECT
       COALESCE(SUM(CASE WHEN currency='ARS' THEN amount ELSE 0 END), 0) as ars,
       COALESCE(SUM(CASE WHEN currency='USD' THEN amount ELSE 0 END), 0) as usd
     FROM expenses`
  );

  const salesResult = await execute(
    `SELECT
       COALESCE(SUM(CASE WHEN currency='ARS' THEN amount ELSE 0 END), 0) as ars,
       COALESCE(SUM(CASE WHEN currency='USD' THEN amount ELSE 0 END), 0) as usd
     FROM sales`
  );

  const expenses = expenseResult.rows[0];
  const sales = salesResult.rows[0];
  const net_ars = (sales.ars as number) - (expenses.ars as number);
  const net_usd = (sales.usd as number) - (expenses.usd as number);

  const result: Record<string, unknown> = {
    expenses_ars: expenses.ars,
    expenses_usd: expenses.usd,
    sales_ars: sales.ars,
    sales_usd: sales.usd,
    net_ars,
    net_usd,
  };

  if (months && Number(months) > 0) {
    const m = Number(months);
    result.monthly_target_ars = net_ars < 0 ? Math.abs(net_ars) / m : 0;
    result.monthly_target_usd = net_usd < 0 ? Math.abs(net_usd) / m : 0;
    result.months = m;
  }

  return Response.json(result);
}
