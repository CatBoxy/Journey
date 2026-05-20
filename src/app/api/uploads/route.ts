import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");
  if (!file || file.includes("..") || file.includes("/")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const filePath = path.join(UPLOAD_DIR, file);
    const buffer = await readFile(filePath);
    const ext = path.extname(file).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    return new Response(buffer, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
