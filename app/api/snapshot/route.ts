import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow larger bodies for base64 photos.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stock_group, date, user, items } = body ?? {};

    if (!["raw_material", "wip", "import"].includes(stock_group)) {
      return NextResponse.json(
        { ok: false, error: "stock_group ไม่ถูกต้อง" },
        { status: 400 },
      );
    }
    if (!date || !user) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุวันที่และชื่อผู้บันทึก" },
        { status: 400 },
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ไม่มีรายการสินค้า" },
        { status: 400 },
      );
    }

    const data = await callAppsScript({
      action: "addSnapshot",
      stock_group,
      date,
      user,
      items,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
