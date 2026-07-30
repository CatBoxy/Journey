import { execute, buildPartialUpdate } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  let sql = "SELECT * FROM products";
  const args: unknown[] = [];
  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }
  sql += " ORDER BY created_at DESC";
  const result = await execute(sql, args);
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, materials, currency, status, price } = body;
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await execute(
    "INSERT INTO products (name, description, materials, currency, status, price) VALUES (?, ?, ?, ?, ?, ?)",
    [name, description || "", materials || "", currency || "ARS", status || "in_progress", price ?? null]
  );
  const row = await execute("SELECT * FROM products WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, description, materials, currency, status } = body;
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const { price } = body;
  const update = buildPartialUpdate("products", id, { name, description, materials, currency, status, price });
  if (update) await execute(update.sql, update.args);
  const row = await execute("SELECT * FROM products WHERE id = ?", [id]);
  return Response.json(row.rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }
  const entryImages = await execute(
    `SELECT pei.filename FROM product_work_entry_images pei
     JOIN product_work_entries pe ON pe.id = pei.entry_id
     WHERE pe.product_id = ?`,
    [id]
  );
  const productImages = await execute(
    "SELECT filename FROM product_images WHERE product_id = ?",
    [id]
  );
  const { deleteImage } = await import("@/lib/cloudinary");
  for (const img of [...entryImages.rows, ...productImages.rows]) {
    try { await deleteImage(img.filename as string); } catch { /* already gone */ }
  }
  await execute("DELETE FROM products WHERE id = ?", [id]);
  return Response.json({ ok: true });
}
