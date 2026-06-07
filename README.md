# Restaurant Stock Movement Chatbot Starter

ชุดนี้ทำให้ข้อมูล stock วิ่ง 3 ทาง:

1. บันทึกลง Google Sheets ใน sheet `stock_movement`
2. สร้าง/อัปเดต Google Docs เป็น daily report ของวันนั้น
3. ส่งรายงานของเหลือเข้า LINE group ผ่าน chatbot

หน้าเว็บใน GitHub Pages ใช้ลงข้อมูล เทียบยอดใช้ และแยก stock เป็น `Raw material` กับ `WIP / Work in process`

## Workflow หน้าเว็บล่าสุด

หน้าแรกจะแยกหมวดก่อนเริ่มกรอก:

```text
นับ Stock รายวัน
  -> กรอกชื่อ + นามสกุลผู้บันทึก
  -> กรอกจำนวน / หน่วย / หมายเหตุ ของ Raw material ทุกตัว
  -> บันทึกเป็น batch ลง stock_movement

นับ Stock WIP รายวัน
  -> กรอกชื่อ + นามสกุลผู้บันทึก
  -> กรอกจำนวน / หน่วย / หมายเหตุ ของ WIP ทุกตัว
  -> บันทึกเป็น batch ลง stock_movement
```

หลังบันทึก ระบบจะส่งข้อมูลต่อไปยัง Google Sheet, Google Docs daily report และ LINE group ตาม flow เดิม

## โครงสร้างข้อมูล

Sheet: `stock_movement`

| column | meaning |
| --- | --- |
| timestamp | เวลาที่บันทึก |
| date | วันที่ stock |
| item_id | id ที่สร้างจากชื่อสินค้า |
| item_name | ชื่อสินค้า |
| stock_group | `raw_material` หรือ `wip` |
| movement_type | `opening_stock`, `receive`, `closing_stock`, `adjustment`, `waste` |
| quantity | จำนวน |
| unit | หน่วย |
| branch | สาขา |
| note | หมายเหตุ |
| user | ผู้ลงข้อมูล |

สูตรยอดใช้:

```text
ยอดใช้ = opening_stock ของวันที่เริ่ม + receive ระหว่างช่วงวันที่เลือก - closing_stock ของวันที่สิ้นสุด
```

สำหรับรายงานของเหลือรายวัน ระบบใช้สูตร:

```text
ของเหลือ = closing_stock ถ้ามีการปิดวันแล้ว
ของเหลือชั่วคราว = opening_stock + receive + adjustment - waste ถ้ายังไม่ได้ปิดวัน
ยอดใช้ประเมิน = opening_stock + receive + adjustment - waste - ของเหลือ
```

## วิธีติดตั้ง Google Apps Script

1. สร้าง Google Sheet ใหม่
2. ไปที่ Extensions > Apps Script
3. วางโค้ดจาก `apps-script/Code.gs`
4. กด Save
5. กด Deploy > New deployment
6. เลือก type เป็น Web app
7. ตั้งค่า Execute as: Me
8. ตั้งค่า Who has access: Anyone
9. Copy Web app URL
10. นำ URL ไปใส่ใน environment variable `APPS_SCRIPT_URL` (ดูหัวข้อ "รันแบบ Next.js + Vercel" ด้านล่าง)

## ตั้งค่า LINE group

ใน Apps Script:

1. Project Settings > Script Properties
2. เพิ่ม property:

```text
LINE_CHANNEL_ACCESS_TOKEN = token จาก LINE Messaging API
LINE_GROUP_ID = group id ที่ต้องการส่งรายงาน
```

ถ้ายังไม่ได้ใส่ LINE token ระบบจะยังบันทึกลง Google Sheets ได้ แต่จะไม่ส่งรายงานเข้า group

## Google Docs daily report

ทุกครั้งที่ user update stock ระบบจะสร้างหรืออัปเดต Google Docs ชื่อ:

```text
Daily Stock Report - YYYY-MM-DD - สาขา
```

ในเอกสารจะมีตาราง:

```text
Group | Item | Opening | Receive | Adjust | Waste | Remaining | Usage | Unit
```

ใช้สำหรับส่งต่อ/ตรวจย้อนหลัง และใช้ประเมินร่วมกับยอดขายหน้าร้านหรือยอดขาย Delivery ได้

## รันแบบ Next.js + Vercel (เวอร์ชันปัจจุบัน)

หน้าเว็บถูกเขียนใหม่เป็น Next.js (App Router) + React และ deploy บน Vercel
โดยไม่ต้องรัน server เอง การเรียก Apps Script ทำผ่าน API route ฝั่ง server
(`app/api/movements`, `app/api/usage`) จึงไม่ต้องใช้ `no-cors`/JSONP อีกต่อไป
และได้ผลลัพธ์ JSON จริงพร้อม error ที่อ่านได้

โครงสร้างหลัก:

```text
app/                หน้าเว็บ + API routes
lib/catalog.ts      รายการวัตถุดิบ Raw material / WIP
lib/appsScript.ts   ตัว proxy เรียก Apps Script ฝั่ง server
apps-script/        โค้ด Google Apps Script (backend เดิม)
legacy/             หน้าเว็บ static เดิม (เก็บไว้อ้างอิง)
```

### รันบนเครื่อง

1. ติดตั้ง dependencies: `npm install`
2. สร้างไฟล์ `.env.local` จาก `.env.example` แล้วใส่ค่า:

```text
APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
```

3. รัน dev: `npm run dev` แล้วเปิด `http://localhost:3000`
4. รัน production build: `npm run build` แล้ว `npm run start`

### Deploy บน Vercel

1. push repo ขึ้น GitHub
2. ไปที่ vercel.com > New Project > เลือก repo นี้ (Vercel ตรวจ Next.js ให้อัตโนมัติ)
3. ตั้งค่า Environment Variable: `APPS_SCRIPT_URL` = Web app URL ที่ได้จาก Apps Script
4. กด Deploy แล้วเปิด URL ที่ Vercel ให้มา

> `APPS_SCRIPT_URL` เป็น env ฝั่ง server เท่านั้น จึงไม่ถูกเปิดเผยใน browser
> (ต่างจากเวอร์ชัน static เดิมที่ฝัง URL ไว้ใน `config.js`)

## Flow การใช้งาน

ลงข้อมูล:

```text
GitHub Pages form
  -> Google Apps Script
  -> Google Sheets stock_movement
  -> Google Docs daily report
  -> LINE group remaining-stock report
```

Flow ประเมินยอดใช้จากรูป:

```text
Stock update
  -> คำนวณของเหลือประจำวัน
  -> ปลายงวด / closing stock
  -> ยอดใช้
  -> เทียบกับยอดขายหน้าร้านและ Delivery
  -> ประเมินความผิดปกติหรือของที่ต้องเตรียมเพิ่ม
```

เทียบยอดใช้:

```text
GitHub Pages compare form
  -> Google Apps Script
  -> อ่าน stock_movement ผ่าน JSONP
  -> คำนวณ usage
  -> แสดงในตาราง
```

หมายเหตุ: หน้าเว็บใช้ `POST no-cors` สำหรับการบันทึก เพื่อให้ส่งข้อมูลจาก GitHub Pages ไป Apps Script ได้ง่าย ส่วนการเทียบยอดใช้ `GET JSONP` เพราะต้องอ่านผลลัพธ์กลับมาแสดงในตาราง
