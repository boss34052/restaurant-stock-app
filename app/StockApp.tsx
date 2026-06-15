"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Beef,
  Camera,
  ChefHat,
  Eraser,
  ImageIcon,
  Loader2,
  Package,
  Send,
  Truck,
  X,
} from "lucide-react";

import { stockCatalog, type StockGroup } from "@/lib/catalog";
import { compressImage } from "@/lib/image";
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

type View = "home" | "user" | "count";
type Tone = "raw" | "wip" | "import";
type ItemInput = { quantity: string; image?: string };

const todayIso = () => new Date().toISOString().slice(0, 10);

const TONE: Record<StockGroup, Tone> = {
  raw_material: "raw",
  wip: "wip",
  import: "import",
};

export default function StockApp({ apiConfigured }: { apiConfigured: boolean }) {
  const [view, setView] = useState<View>("home");
  const [category, setCategory] = useState<StockGroup | "">("");

  const [name, setName] = useState("");
  const [stockDate, setStockDate] = useState("");

  const [itemInputs, setItemInputs] = useState<Record<string, ItemInput>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setStockDate(todayIso());
  }, []);

  const user = name.trim();
  const catalog = category ? stockCatalog[category] : null;
  const tone: Tone = category ? TONE[category] : "raw";
  const items = useMemo(() => catalog?.items ?? [], [catalog]);
  const filledCount = useMemo(
    () => Object.values(itemInputs).filter((i) => i.quantity !== "").length,
    [itemInputs],
  );
  const photoCount = useMemo(
    () => Object.values(itemInputs).filter((i) => i.image).length,
    [itemInputs],
  );

  function goToCategory(next: StockGroup) {
    setCategory(next);
    setItemInputs({});
    setView("user");
  }

  function updateItem(id: string, patch: Partial<ItemInput>) {
    setItemInputs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function clearItemInputs() {
    setItemInputs({});
  }

  function submitUser(event: React.FormEvent) {
    event.preventDefault();
    setView("count");
  }

  async function submitSnapshot(event: React.FormEvent) {
    event.preventDefault();
    if (!catalog || !category) return;
    if (filledCount === 0) {
      toast.warning("กรุณากรอกจำนวนอย่างน้อย 1 รายการ");
      return;
    }

    const payloadItems = items.map((it) => ({
      id: it.id,
      name: it.name,
      unit: it.unit,
      hasImage: Boolean(it.hasImage),
      quantity: itemInputs[it.id]?.quantity ?? "",
      image: it.hasImage ? itemInputs[it.id]?.image ?? "" : "",
    }));

    setSubmitting(true);
    try {
      const response = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_group: category,
          date: stockDate,
          user,
          items: payloadItems,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      toast.success(`บันทึก ${data.saved} รายการ ลงชีต ${data.sheet} แล้ว`);
      clearItemInputs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
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
                  นับ Stock ตอนปิดร้าน พร้อมแนบรูป บันทึกลง Google Sheet
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CategoryCard
              tone="raw"
              icon={<Beef className="size-7" />}
              tag="Raw Material"
              title="นับ Stock รายวัน"
              copy="เนื้อสัตว์ ผัก อาหารทะเล เครื่องปรุง และของแช่แข็ง"
              count={stockCatalog.raw_material.items.length}
              photo={stockCatalog.raw_material.items.filter((i) => i.hasImage).length}
              onClick={() => goToCategory("raw_material")}
            />
            <CategoryCard
              tone="wip"
              icon={<Package className="size-7" />}
              tag="Work In Process"
              title="นับ Stock WIP รายวัน"
              copy="ของเตรียมแล้ว ชุดเกาเหลา และรายการของเสีย (waste)"
              count={stockCatalog.wip.items.length}
              photo={stockCatalog.wip.items.filter((i) => i.hasImage).length}
              onClick={() => goToCategory("wip")}
            />
            <CategoryCard
              tone="import"
              icon={<Truck className="size-7" />}
              tag="Raw Material Import"
              title="รับเข้าวัตถุดิบ"
              copy="บันทึกวัตถุดิบที่รับเข้า (เนื้อสัตว์) พร้อมแนบรูปทุกตัว"
              count={stockCatalog.import.items.length}
              photo={stockCatalog.import.items.filter((i) => i.hasImage).length}
              onClick={() => goToCategory("import")}
            />
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
                <Badge variant={tone} className="w-fit">
                  {catalog?.eyebrow}
                </Badge>
                <CardTitle className="text-xl">
                  {catalog ? `กรอกชื่อก่อน${catalog.title}` : "กรอกชื่อก่อนเริ่มนับ"}
                </CardTitle>
                <CardDescription>ระบุผู้ตรวจนับและวันที่ ก่อนเริ่มกรอกจำนวน</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitUser}>
                  <Field label="ชื่อผู้ตรวจนับ">
                    <Input
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
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
            <form onSubmit={submitSnapshot}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Badge variant={tone} className="mb-2">
                        {catalog?.eyebrow}
                      </Badge>
                      <CardTitle className="text-xl">{catalog?.title}</CardTitle>
                      <CardDescription className="mt-1">
                        ผู้บันทึก: <b>{user || "—"}</b> · วันที่: <b>{stockDate}</b>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{filledCount} รายการ</Badge>
                      {photoCount > 0 && (
                        <Badge variant="secondary">
                          <ImageIcon className="size-3" /> {photoCount} รูป
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-muted-foreground">
                    กรอกเฉพาะรายการที่นับได้ — ระบบบันทึกทุกคอลัมน์ แต่นับเฉพาะช่องที่กรอกจำนวน
                    {items.some((i) => i.hasImage) && " · รายการที่มีไอคอนกล้องแนบรูปได้"}
                  </div>

                  {items.map((item) => {
                    const input = itemInputs[item.id] ?? { quantity: "" };
                    const active = input.quantity !== "";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-xl border p-3 transition-colors",
                          active ? "border-primary/40 bg-primary/5" : "bg-card",
                        )}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                          <div className="flex items-center justify-between gap-2 sm:justify-start">
                            <div>
                              <span className="font-semibold">{item.name}</span>
                              {item.note && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({item.note})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="grid flex-1 gap-1.5 sm:w-40">
                              <Label className="text-xs">จำนวน ({item.unit})</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.001"
                                inputMode="decimal"
                                placeholder="0"
                                value={input.quantity}
                                onChange={(e) =>
                                  updateItem(item.id, { quantity: e.target.value })
                                }
                              />
                            </div>
                            {item.hasImage && (
                              <ImageField
                                value={input.image}
                                onChange={(img) => updateItem(item.id, { image: img })}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="sticky bottom-4 z-10 mt-4 flex gap-3 rounded-2xl border bg-card/80 p-3 shadow-lg backdrop-blur">
                <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Send /> บันทึกทั้งหมด
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
      </div>
    </div>
  );
}

function ImageField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (img: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch {
      toast.error("แนบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">รูป</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="relative size-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="แนบรูป"
            className="size-10 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-destructive-foreground"
            aria-label="ลบรูป"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Camera className="text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
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
  photo,
  onClick,
}: {
  tone: Tone;
  icon: React.ReactNode;
  tag: string;
  title: string;
  copy: string;
  count: number;
  photo: number;
  onClick: () => void;
}) {
  const toneGradient =
    tone === "raw"
      ? "bg-gradient-to-br from-raw/12 to-raw/5"
      : tone === "wip"
        ? "bg-gradient-to-br from-wip/12 to-wip/5"
        : "bg-gradient-to-br from-primary/12 to-primary/5";
  const toneSolid =
    tone === "raw" ? "bg-raw" : tone === "wip" ? "bg-wip" : "bg-primary";
  const toneText =
    tone === "raw" ? "text-raw" : tone === "wip" ? "text-wip" : "text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        toneGradient,
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "grid size-14 place-items-center rounded-2xl text-white shadow-sm",
            toneSolid,
          )}
        >
          {icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={tone}>{count} รายการ</Badge>
          {photo > 0 && (
            <Badge variant="secondary">
              <ImageIcon className="size-3" /> {photo} รายการแนบรูป
            </Badge>
          )}
        </div>
      </div>
      <p
        className={cn(
          "mt-5 text-xs font-semibold uppercase tracking-wider",
          toneText,
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
