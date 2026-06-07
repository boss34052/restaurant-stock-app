export type StockGroup = "raw_material" | "wip";

export type CatalogItem = {
  id: string;
  name: string;
  unit: string;
};

export type CatalogEntry = {
  title: string;
  eyebrow: string;
  copy: string;
  items: CatalogItem[];
};

const toItems = (rows: [string, string, string][]): CatalogItem[] =>
  rows.map(([id, name, unit]) => ({ id, name, unit }));

export const stockCatalog: Record<StockGroup, CatalogEntry> = {
  raw_material: {
    title: "นับ Stock รายวัน",
    eyebrow: "Raw Material",
    copy: "วัตถุดิบคงเหลือทั้งหมด เช่น เนื้อ หมู ไก่ กุ้ง ผัก เส้น เครื่องปรุง",
    items: toItems([
      ["beef_slice", "เนื้อวัวสไลซ์", "กรัม"],
      ["pork_slice", "หมูสไลซ์", "กรัม"],
      ["chicken", "ไก่", "กรัม"],
      ["shrimp", "กุ้ง", "กรัม"],
      ["squid", "ปลาหมึก", "กรัม"],
      ["pork_liver", "ตับหมู", "กรัม"],
      ["fish_ball", "ลูกชิ้นปลา", "ลูก"],
      ["pork_ball", "ลูกชิ้นหมู", "ลูก"],
      ["tofu", "เต้าหู้", "ชิ้น"],
      ["egg", "ไข่ไก่", "ฟอง"],
      ["glass_noodle", "วุ้นเส้น", "ห่อ"],
      ["small_noodle", "เส้นเล็ก", "กิโลกรัม"],
      ["wide_noodle", "เส้นใหญ่", "กิโลกรัม"],
      ["egg_noodle", "บะหมี่", "ก้อน"],
      ["instant_noodle", "มาม่า", "ห่อ"],
      ["morning_glory", "ผักบุ้ง", "กิโลกรัม"],
      ["bean_sprout", "ถั่วงอก", "กิโลกรัม"],
      ["chinese_cabbage", "ผักกาดขาว", "กิโลกรัม"],
      ["celery", "ขึ้นฉ่าย", "กำ"],
      ["spring_onion", "ต้นหอม", "กำ"],
      ["coriander", "ผักชี", "กำ"],
      ["garlic", "กระเทียม", "กิโลกรัม"],
      ["fried_garlic", "กระเทียมเจียว", "กรัม"],
      ["chili_powder", "พริกป่น", "กรัม"],
      ["fish_sauce", "น้ำปลา", "ขวด"],
      ["sugar", "น้ำตาล", "กิโลกรัม"],
      ["vinegar", "น้ำส้มสายชู", "ขวด"],
      ["pickled_chili", "พริกน้ำส้ม", "ขวด"],
      ["suki_sauce", "น้ำจิ้มสุกี้", "ขวด"],
      ["broth_base", "วัตถุดิบน้ำซุป", "ชุด"],
      ["drink_water", "น้ำเปล่า", "ขวด"],
      ["soft_drink", "น้ำอัดลม", "ขวด"],
      ["other_raw", "วัตถุดิบอื่นๆ", "หน่วย"],
    ]),
  },
  wip: {
    title: "นับ Stock WIP รายวัน",
    eyebrow: "Work In Process",
    copy: "วัตถุดิบที่เตรียมแล้วหรือพร้อมขาย เช่น ของหมัก น้ำซุป ของจัดชุด",
    items: toItems([
      ["marinated_beef", "เนื้อหมัก", "กรัม"],
      ["marinated_pork", "หมูหมัก", "กรัม"],
      ["marinated_chicken", "ไก่หมัก", "กรัม"],
      ["prepared_shrimp", "กุ้งเตรียมพร้อม", "กรัม"],
      ["prepared_squid", "ปลาหมึกเตรียมพร้อม", "กรัม"],
      ["prepared_veg", "ผักล้าง/หั่นพร้อมใช้", "ถาด"],
      ["prepared_noodle", "เส้นแบ่งชุดพร้อมขาย", "ชุด"],
      ["prepared_ball_set", "ลูกชิ้น/ของพร้อมเสิร์ฟ", "ชุด"],
      ["soup_ready", "น้ำซุปที่เตรียมไว้", "ลิตร"],
      ["suki_sauce_cup", "น้ำจิ้มแบ่งถ้วย", "ถ้วย"],
      ["dine_in_set", "ชุดหน้าร้านพร้อมขาย", "ชุด"],
      ["delivery_set", "ชุด Delivery พร้อมส่ง", "ชุด"],
      ["side_dish", "เครื่องเคียงเตรียมไว้", "ชุด"],
      ["other_wip", "WIP อื่นๆ", "หน่วย"],
    ]),
  },
};

export const movementTypes: { value: string; label: string }[] = [
  { value: "closing_stock", label: "ปิดวัน / ของเหลือปลายวัน" },
  { value: "opening_stock", label: "เปิดวัน / เริ่มต้นวัน" },
  { value: "receive", label: "รับเข้า" },
  { value: "adjustment", label: "ปรับยอด" },
  { value: "waste", label: "เสีย/ทิ้ง" },
];
