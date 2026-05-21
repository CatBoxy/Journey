import { execute } from "@/lib/db";
import { NextRequest } from "next/server";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, text } = body;
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  await execute("UPDATE project_entries SET text = ? WHERE id = ?", [text || "", id]);
  return Response.json({ ok: true });
}
