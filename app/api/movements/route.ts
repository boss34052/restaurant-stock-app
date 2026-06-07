import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const movements = body?.movements;

    if (!Array.isArray(movements) || movements.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ไม่มีรายการให้บันทึก" },
        { status: 400 },
      );
    }

    const data = await callAppsScript({
      action: "addBatchMovements",
      movements,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
