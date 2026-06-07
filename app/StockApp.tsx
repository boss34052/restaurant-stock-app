"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Beef,
  CheckCircle2,
  ChefHat,
  Eraser,
  Loader2,
  Package,
  Send,
  Sheet,
  TrendingUp,
} from "lucide-react";

import { movementTypes, stockCatalog, type StockGroup } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
const yesterdayIso = () =>
  new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const flowSteps = [
  { n: 1, label: "นับ Stock", icon: Package },
  { n: 2, label: "ส่ง LINE + Sheet", icon: Send },
  { n: 3, label: "เทียบยอดขาย", icon: TrendingUp },
  { n: 4, label: "สรุปรายงาน", icon: BarChart3 },
];

export default function StockApp({ apiConfigured }: { apiConfigured: boolean }) {
  const [view, setView] = useState<View>("home");
  const [category, setCategory] = useState<StockGroup | "">("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stockDate, setStockDate] = useState("");
  const [branch, setBranch] = useState("สาขาหลัก");

  const [movementType, setMovementType] = useState("closing_stock");
  const [itemInputs, setItemInputs] = useState<Record<string, ItemInput>>({});
  const [submitting, setSubmitting] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [compareBranch, setCompareBranch] = useState("สาขาหลัก");
  const [usageRows, setUsageRows] = useState<UsageRow[] | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setStockDate(todayIso());
    setToDate(todayIso());
    setFromDate(yesterdayIso());
  }, []);

  const user = `${firstName} ${lastName}`.trim();
  const catalog = category ? stockCatalog[category] : null;
  const items = useMemo(() => catalog?.items ?? [], [catalog]);
  const filledCount = useMemo(
    () => Object.values(itemInputs).filter((i) => i.quantity !== "").length,
    [itemInputs],
  );

  function goToCategory(next: StockGroup) {
    setCategory(next);
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
      .map((item) => ({
        item,
        input: itemInputs[item.id] ?? { quantity: "", unit: item.unit, note: "" },
      }))
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
      toast.warning("กรุณากรอกจำนวนอย่างน้อย 1 รายการ");
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
      if (!response.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      toast.success(`บันทึก ${movements.length} รายการ และส่งรายงานแล้ว`);
      clearItemInputs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
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
      if (!response.ok || !data.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setUsageRows(data.rows as UsageRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/40 via-background to-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="mb-6 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <ChefHat className="size-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Flow Stock รายวัน
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">ร้านสุกี้ลิ้นชา</h1>
                <p className="mt-1 text-sm text-white/80">
                  นับ Stock ตอนปิดร้าน ส่งเข้า LINE, Google Sheet และ Google Docs
                </p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur",
                apiConfigured ? "text-emerald-100" : "text-amber-100",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  apiConfigured ? "bg-emerald-300" : "bg-amber-300",
                )}
              />
              {apiConfigured ? "พร้อมเชื่อมต่อ API" : "ยังไม่ได้ตั้งค่า API"}
            </span>
          </div>
        </header>

        {/* HOME */}
        {view === "home" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <CategoryCard
                tone="raw"
                icon={<Beef className="size-7" />}
                tag="Raw Material"
                title="นับ Stock รายวัน"
                copy="เนื้อ หมู ผัก เส้น เครื่องปรุง และวัตถุดิบทั้งหมด"
                count={stockCatalog.raw_material.items.length}
                onClick={() => goToCategory("raw_material")}
              />
              <CategoryCard
                tone="wip"
                icon={<Package className="size-7" />}
                tag="Work In Process"
                title="นับ Stock WIP รายวัน"
                copy="ของเตรียมแล้ว น้ำซุป ของพร้อมขาย"
                count={stockCatalog.wip.items.length}
                onClick={() => goToCategory("wip")}
              />
            </div>

            <Card>
              <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                {flowSteps.map((step) => (
                  <div
                    key={step.n}
                    className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="size-4.5" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs text-muted-foreground">ขั้นที่ {step.n}</p>
                      <p className="text-sm font-semibold">{step.label}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button variant="outline" size="lg" onClick={() => setView("report")}>
                <TrendingUp /> ไปหน้าเทียบยอดใช้
              </Button>
            </div>
          </div>
        )}

        {/* USER */}
        {view === "user" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView("home")}>
              <ArrowLeft /> กลับ
            </Button>
            <Card>
              <CardHeader>
                <Badge variant={category === "wip" ? "wip" : "raw"} className="w-fit">
                  {catalog?.eyebrow}
                </Badge>
                <CardTitle className="text-xl">
                  {catalog ? `กรอกชื่อก่อน${catalog.title}` : "กรอกชื่อก่อนเริ่มนับ"}
                </CardTitle>
                <CardDescription>
                  ระบุผู้บันทึก วันที่ และสาขา ก่อนเริ่มกรอกจำนวน
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitUser}>
                  <Field label="ชื่อ">
                    <Input
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </Field>
                  <Field label="นามสกุล">
                    <Input
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </Field>
                  <Field label="วันที่นับ">
                    <Input
                      type="date"
                      required
                      value={stockDate}
                      onChange={(e) => setStockDate(e.target.value)}
                    />
                  </Field>
                  <Field label="สาขา">
                    <Input
                      required
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" size="lg" className="sm:col-span-2">
                    ไปหน้ากรอก Stock <ArrowRight />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* COUNT */}
        {view === "count" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView("user")}>
              <ArrowLeft /> กลับ
            </Button>
            <form onSubmit={submitBatch}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Badge
                        variant={category === "wip" ? "wip" : "raw"}
                        className="mb-2"
                      >
                        {catalog?.eyebrow}
                      </Badge>
                      <CardTitle className="text-xl">{catalog?.title}</CardTitle>
                      <CardDescription className="mt-1">
                        ผู้บันทึก: <b>{user || "—"}</b> · วันที่: <b>{stockDate}</b> ·{" "}
                        <b>{branch}</b>
                      </CardDescription>
                    </div>
                    <div className="w-full sm:w-64">
                      <Label className="mb-1.5">ประเภทการนับ</Label>
                      <Select value={movementType} onValueChange={setMovementType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {movementTypes.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">
                      กรอกเฉพาะรายการที่นับได้ — ระบบบันทึกเฉพาะช่องที่กรอกจำนวน
                    </span>
                    <Badge variant="secondary">{filledCount} รายการ</Badge>
                  </div>

                  {items.map((item) => {
                    const input =
                      itemInputs[item.id] ?? {
                        quantity: "",
                        unit: item.unit,
                        note: "",
                      };
                    const active = input.quantity !== "";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "grid grid-cols-1 gap-3 rounded-xl border p-3 transition-colors sm:grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr]",
                          active ? "border-primary/40 bg-primary/5" : "bg-card",
                        )}
                      >
                        <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5">
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {catalog?.eyebrow}
                          </span>
                        </div>
                        <Field label="จำนวน" compact>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0"
                            value={input.quantity}
                            onChange={(e) =>
                              updateItem(item.id, { quantity: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="หน่วย" compact>
                          <Input
                            value={input.unit}
                            onChange={(e) =>
                              updateItem(item.id, { unit: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="หมายเหตุ" compact>
                          <Input
                            placeholder="เช่น เหลือน้อย / ของเสีย"
                            value={input.note}
                            onChange={(e) =>
                              updateItem(item.id, { note: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="sticky bottom-4 z-10 mt-4 flex gap-3 rounded-2xl border bg-card/80 p-3 shadow-lg backdrop-blur">
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Send /> บันทึกทั้งหมดและส่งรายงาน
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={clearItemInputs}
                >
                  <Eraser /> ล้าง
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* REPORT */}
        {view === "report" && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setView("home")}>
              <ArrowLeft /> กลับ
            </Button>
            <Card>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  Usage Compare
                </Badge>
                <CardTitle className="text-xl">เทียบยอดใช้จาก stock_movement</CardTitle>
                <CardDescription>
                  ยอดใช้ = เปิดวัน + รับเข้า − ปิดวัน ในช่วงวันที่ที่เลือก
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
                  onSubmit={submitCompare}
                >
                  <Field label="วันที่เริ่ม">
                    <Input
                      type="date"
                      required
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </Field>
                  <Field label="วันที่สิ้นสุด">
                    <Input
                      type="date"
                      required
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </Field>
                  <Field label="สาขา">
                    <Input
                      required
                      value={compareBranch}
                      onChange={(e) => setCompareBranch(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" size="lg" disabled={comparing}>
                    {comparing ? (
                      <>
                        <Loader2 className="animate-spin" /> กำลังคำนวณ...
                      </>
                    ) : (
                      <>
                        <BarChart3 /> คำนวณยอดใช้
                      </>
                    )}
                  </Button>
                </form>

                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>กลุ่ม</TableHead>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-right">เปิดวัน</TableHead>
                        <TableHead className="text-right">รับเข้า</TableHead>
                        <TableHead className="text-right">ปิดวัน</TableHead>
                        <TableHead className="text-right">ยอดใช้</TableHead>
                        <TableHead>หน่วย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageRows === null ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-10 text-center text-muted-foreground"
                          >
                            เลือกวันที่เพื่อดูรายงาน
                          </TableCell>
                        </TableRow>
                      ) : usageRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-10 text-center text-muted-foreground"
                          >
                            ไม่พบข้อมูลในช่วงวันที่เลือก
                          </TableCell>
                        </TableRow>
                      ) : (
                        usageRows.map((row, index) => (
                          <TableRow key={`${row.item_name}-${index}`}>
                            <TableCell>
                              <Badge
                                variant={row.stock_group === "wip" ? "wip" : "raw"}
                              >
                                {row.stock_group === "wip" ? "WIP" : "Raw"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.item_name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.opening_stock)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.receive)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.closing_stock)}
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-primary">
                              {formatNumber(row.usage)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.unit}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  compact,
  children,
}: {
  label: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className={compact ? "text-xs" : undefined}>{label}</Label>
      {children}
    </div>
  );
}

function CategoryCard({
  tone,
  icon,
  tag,
  title,
  copy,
  count,
  onClick,
}: {
  tone: "raw" | "wip";
  icon: React.ReactNode;
  tag: string;
  title: string;
  copy: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        tone === "raw"
          ? "bg-gradient-to-br from-raw/12 to-raw/5"
          : "bg-gradient-to-br from-wip/12 to-wip/5",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "grid size-14 place-items-center rounded-2xl text-white shadow-sm",
            tone === "raw" ? "bg-raw" : "bg-wip",
          )}
        >
          {icon}
        </div>
        <Badge variant={tone}>{count} รายการ</Badge>
      </div>
      <p
        className={cn(
          "mt-5 text-xs font-semibold uppercase tracking-wider",
          tone === "raw" ? "text-raw" : "text-wip",
        )}
      >
        {tag}
      </p>
      <h2 className="mt-1 text-xl font-bold">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{copy}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 transition-colors group-hover:text-foreground">
        เริ่มนับ <ArrowRight className="size-4" />
      </span>
    </button>
  );
}
