import { NextRequest } from "next/server";
import { createMachine, errorResponse, listMachines, updateMachine } from "@/lib/workshop";

export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get("all") === "1";
    return Response.json(await listMachines(all));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    return Response.json(await createMachine(await request.json()), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...data } = await request.json();
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    return Response.json(await updateMachine(Number(id), data));
  } catch (e) {
    return errorResponse(e);
  }
}
