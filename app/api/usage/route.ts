import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/appsScript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { from_date, to_date, branch } = body ?? {};

    if (!from_date || !to_date || !branch) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุวันที่เริ่ม วันที่สิ้นสุด และสาขา" },
        { status: 400 },
      );
    }

    const data = await callAppsScript({
      action: "compareUsage",
      from_date,
      to_date,
      branch,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
