"use client";

import { useEffect, useMemo, useState } from "react";
import {
  movementTypes,
  stockCatalog,
  type StockGroup,
} from "@/lib/catalog";

type View = "home" | "user" | "count" | "report";

type ItemInput = { quantity: string; unit: string; note: string };

type UsageRow = {
  stock_group: string;
  item_name: string;
  opening_stock: number;
  receive: number;
  closing_stock: number;
  usage: number;
  unit: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const yesterdayIso = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function formatStockGroup(value: string) {
  return value === "wip" ? "WIP" : "Raw material";
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function StockApp({ apiConfigured }: { apiConfigured: boolean }) {
  const [view, setView] = useState<View>("home");
  const [category, setCategory] = useState<StockGroup | "">("");

  // User form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stockDate, setStockDate] = useState("");
  const [branch, setBranch] = useState("สาขาหลัก");

  // Count form
  const [movementType, setMovementType] = useState("closing_stock");
  const [itemInputs, setItemInputs] = useState<Record<string, ItemInput>>({});
  const [submitting, setSubmitting] = useState(false);

  // Compare form
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [compareBranch, setCompareBranch] = useState("สาขาหลัก");
  const [usageRows, setUsageRows] = useState<UsageRow[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const [toast, setToast] = useState("");
  const [toastShown, setToastShown] = useState(false);

  // Set dates on the client only, to avoid SSR/CSR hydration mismatch.
  useEffect(() => {
    setStockDate(todayIso());
    setToDate(todayIso());
    setFromDate(yesterdayIso());
  }, []);

  const user = `${firstName} ${lastName}`.trim();
  const catalog = category ? stockCatalog[category] : null;

  const items = useMemo(() => catalog?.items ?? [], [catalog]);

  function showToast(message: string) {
    setToast(message);
    setToastShown(true);
    window.setTimeout(() => setToastShown(false), 3000);
  }

  function goToCategory(next: StockGroup) {
    setCategory(next);
    // Seed inputs with each item's default unit.
    const seeded: Record<string, ItemInput> = {};
    stockCatalog[next].items.forEach((item) => {
      seeded[item.id] = { quantity: "", unit: item.unit, note: "" };
    });
    setItemInputs(seeded);
    setView("user");
  }

  function updateItem(id: string, patch: Partial<ItemInput>) {
    setItemInputs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function clearItemInputs() {
    setItemInputs((prev) => {
      const next: Record<string, ItemInput> = {};
      Object.entries(prev).forEach(([id, value]) => {
        next[id] = { ...value, quantity: "", note: "" };
      });
      return next;
    });
  }

  function collectMovements() {
    if (!catalog || !category) return [];
    return items
      .map((item) => {
        const input = itemInputs[item.id] ?? { quantity: "", unit: item.unit, note: "" };
        return { item, input };
      })
      .filter(({ input }) => input.quantity !== "")
      .map(({ item, input }) => ({
        date: stockDate,
        item_id: item.id,
        item_name: item.name,
        stock_group: category,
        movement_type: movementType,
        quantity: Number(input.quantity),
        unit: input.unit.trim(),
        branch,
        note: input.note.trim(),
        user,
      }));
  }

  function submitUser(event: React.FormEvent) {
    event.preventDefault();
    setView("count");
  }

  async function submitBatch(event: React.FormEvent) {
    event.preventDefault();
    const movements = collectMovements();
    if (!movements.length) {
      showToast("กรุณากรอกจำนวนอย่างน้อย 1 รายการ");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movements }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "บันทึกไม่สำเร็จ");
      }
      showToast(`บันทึก ${movements.length} รายการ และส่งรายงานแล้ว`);
      clearItemInputs();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCompare(event: React.FormEvent) {
    event.preventDefault();
    setComparing(true);
    try {
      const response = await fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_date: fromDate,
          to_date: toDate,
          branch: compareBranch,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      }
      setUsageRows(data.rows as UsageRow[]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setComparing(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Flow Stock รายวัน</p>
          <h1>ร้านสุกี้ลิ้นชา</h1>
          <p className="subhead">
            นับ Stock ตอนปิดร้าน ส่งเข้า LINE, Google Sheet และ Google Docs
          </p>
        </div>
        <span className={`status-pill${apiConfigured ? " ready" : ""}`}>
          {apiConfigured ? "พร้อมเชื่อมต่อ API" : "ยังไม่ได้ตั้งค่า API"}
        </span>
      </header>

      {/* HOME */}
      <section className={`view${view === "home" ? " active" : ""}`}>
        <div className="hero-card">
          <div className="step-badge">1</div>
          <div>
            <h2>เลือกหมวดหมู่ที่ต้องการนับ</h2>
            <p>
              เริ่มจากนับวัตถุดิบคงเหลือประจำวัน
              แล้วระบบจะนำข้อมูลไปสรุปยอดใช้และรายงานต่อ
            </p>
          </div>
        </div>

        <div className="category-grid">
          <button
            className="category-card raw"
            type="button"
            onClick={() => goToCategory("raw_material")}
          >
            <span className="category-icon">RM</span>
            <span className="category-title">นับ Stock รายวัน</span>
            <span className="category-copy">
              Raw material: เนื้อ หมู ผัก เส้น เครื่องปรุง และวัตถุดิบทั้งหมด
            </span>
          </button>

          <button
            className="category-card wip"
            type="button"
            onClick={() => goToCategory("wip")}
          >
            <span className="category-icon">WIP</span>
            <span className="category-title">นับ Stock WIP รายวัน</span>
            <span className="category-copy">
              Work in process: ของเตรียมแล้ว น้ำซุป ของพร้อมขาย
            </span>
          </button>
        </div>

        <div className="flow-strip">
          <div>
            <strong>1</strong>
            <span>นับ Stock</span>
          </div>
          <div>
            <strong>2</strong>
            <span>ส่ง LINE + Sheet</span>
          </div>
          <div>
            <strong>3</strong>
            <span>เทียบยอดขาย / Delivery</span>
          </div>
          <div>
            <strong>4</strong>
            <span>สรุปรายงาน</span>
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            className="secondary-action"
            type="button"
            onClick={() => setView("report")}
          >
            ไปหน้าเทียบยอดใช้
          </button>
        </div>
      </section>

      {/* USER */}
      <section className={`view${view === "user" ? " active" : ""}`}>
        <button className="back-button" type="button" onClick={() => setView("home")}>
          กลับ
        </button>
        <div className="panel">
          <div className="section-head compact">
            <div>
              <p className="eyebrow">ผู้บันทึกข้อมูล</p>
              <h2>{catalog ? `กรอกชื่อก่อน${catalog.title}` : "กรอกชื่อก่อนเริ่มนับ"}</h2>
            </div>
          </div>

          <form className="user-form" onSubmit={submitUser}>
            <label>
              ชื่อ
              <input
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label>
              นามสกุล
              <input
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label>
              วันที่นับ
              <input
                type="date"
                required
                value={stockDate}
                onChange={(e) => setStockDate(e.target.value)}
              />
            </label>
            <label>
              สาขา
              <input
                type="text"
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </label>
            <button className="primary-action" type="submit">
              ไปหน้ากรอก Stock
            </button>
          </form>
        </div>
      </section>

      {/* COUNT */}
      <section className={`view${view === "count" ? " active" : ""}`}>
        <button className="back-button" type="button" onClick={() => setView("user")}>
          กลับ
        </button>
        <form className="panel count-panel" onSubmit={submitBatch}>
          <div className="section-head">
            <div>
              <p className="eyebrow">{catalog?.eyebrow ?? "Daily Count"}</p>
              <h2>{catalog?.title ?? "นับ Stock รายวัน"}</h2>
              <p className="subhead">
                {catalog
                  ? `${catalog.copy} | ผู้บันทึก: ${user} | วันที่: ${stockDate} | ${branch}`
                  : ""}
              </p>
            </div>
            <label className="movement-select">
              ประเภทการนับ
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
              >
                {movementTypes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-hint">
            กรอกจำนวนตามวัตถุดิบที่นับได้ ระบบจะบันทึกเฉพาะรายการที่กรอกจำนวน
          </div>

          <div className="item-list">
            {items.map((item) => {
              const input = itemInputs[item.id] ?? {
                quantity: "",
                unit: item.unit,
                note: "",
              };
              return (
                <article className="item-row" key={item.id}>
                  <div className="item-main">
                    <strong>{item.name}</strong>
                    <span>{catalog?.eyebrow}</span>
                  </div>
                  <label>
                    จำนวน
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0"
                      value={input.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                    />
                  </label>
                  <label>
                    หน่วย
                    <input
                      type="text"
                      value={input.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                    />
                  </label>
                  <label className="item-note">
                    หมายเหตุ
                    <input
                      type="text"
                      placeholder="เช่น เหลือน้อย / ของเสีย / รับเข้า"
                      value={input.note}
                      onChange={(e) => updateItem(item.id, { note: e.target.value })}
                    />
                  </label>
                </article>
              );
            })}
          </div>

          <div className="sticky-actions">
            <button className="primary-action" type="submit" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "บันทึกทั้งหมดและส่งรายงาน"}
            </button>
            <button
              className="secondary-action"
              type="button"
              onClick={clearItemInputs}
            >
              ล้างจำนวน
            </button>
          </div>
        </form>
      </section>

      {/* REPORT */}
      <section className={`view${view === "report" ? " active" : ""}`}>
        <button className="back-button" type="button" onClick={() => setView("home")}>
          กลับ
        </button>
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Usage Compare</p>
              <h2>เทียบยอดใช้จาก stock_movement</h2>
            </div>
          </div>

          <form className="compare-form" onSubmit={submitCompare}>
            <label>
              วันที่เริ่ม
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label>
              วันที่สิ้นสุด
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            <label>
              สาขา
              <input
                type="text"
                required
                value={compareBranch}
                onChange={(e) => setCompareBranch(e.target.value)}
              />
            </label>
            <button type="submit" disabled={comparing}>
              {comparing ? "กำลังคำนวณ..." : "คำนวณยอดใช้"}
            </button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>กลุ่ม</th>
                  <th>สินค้า</th>
                  <th>เปิดวัน</th>
                  <th>รับเข้า</th>
                  <th>ปิดวัน</th>
                  <th>ยอดใช้</th>
                  <th>หน่วย</th>
                </tr>
              </thead>
              <tbody>
                {usageRows === null ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      เลือกวันที่เพื่อดูรายงาน
                    </td>
                  </tr>
                ) : usageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      ไม่พบข้อมูลในช่วงวันที่เลือก
                    </td>
                  </tr>
                ) : (
                  usageRows.map((row, index) => (
                    <tr key={`${row.item_name}-${index}`}>
                      <td>{formatStockGroup(row.stock_group)}</td>
                      <td>{row.item_name}</td>
                      <td>{formatNumber(row.opening_stock)}</td>
                      <td>{formatNumber(row.receive)}</td>
                      <td>{formatNumber(row.closing_stock)}</td>
                      <td>
                        <strong>{formatNumber(row.usage)}</strong>
                      </td>
                      <td>{row.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className={`toast${toastShown ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </main>
  );
}
