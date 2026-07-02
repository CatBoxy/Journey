import { execute } from "@/lib/db";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return Response.json({ error: "productId is required" }, { status: 400 });
  }
  const result = await execute(
    "SELECT * FROM product_images WHERE product_id = ? ORDER BY created_at DESC",
    [productId]
  );
  return Response.json(result.rows);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const productId = formData.get("productId") as string;
  const file = formData.get("file") as File;
  if (!productId || !file) {
    return Response.json({ error: "productId and file are required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { public_id, url } = await uploadImage(buffer, "journey/products");

  const result = await execute(
    "INSERT INTO product_images (product_id, filename, original_name, url) VALUES (?, ?, ?, ?)",
    [productId, public_id, file.name, url]
  );
  const row = await execute("SELECT * FROM product_images WHERE id = ?", [result.lastInsertRowid!]);
  return Response.json(row.rows[0], { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const result = await execute("SELECT filename FROM product_images WHERE id = ?", [id]);
  if (result.rows.length > 0) {
    await deleteImage(result.rows[0].filename as string);
    await execute("DELETE FROM product_images WHERE id = ?", [id]);
  }
  return Response.json({ ok: true });
}
