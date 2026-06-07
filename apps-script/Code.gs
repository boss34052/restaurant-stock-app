const SHEET_NAME = "stock_movement";
const DAILY_REPORT_PREFIX = "Daily Stock Report";
const HEADERS = [
  "timestamp",
  "date",
  "item_id",
  "item_name",
  "stock_group",
  "movement_type",
  "quantity",
  "unit",
  "branch",
  "note",
  "user"
];

function doGet(e) {
  try {
    if (e.parameter.action === "compareUsage") {
      return jsonpResponse(compareUsage(e.parameter), e.parameter.callback);
    }

    throw new Error("Unknown action");
  } catch (error) {
    return jsonpResponse({ ok: false, error: error.message }, e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");

    if (body.action === "addMovement") {
      return jsonResponse(addMovement(body.movement));
    }

    if (body.action === "addBatchMovements") {
      return jsonResponse(addBatchMovements(body.movements));
    }

    if (body.action === "compareUsage") {
      return jsonResponse(compareUsage(body));
    }

    throw new Error("Unknown action");
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function addMovement(movement) {
  validateMovement(movement);

  appendMovementRows([movement]);
  const summary = getDailySummary(movement.date, movement.branch);
  const doc = upsertDailyReportDoc(movement.date, movement.branch, summary);
  sendLineReport(movement, summary, doc.url);
  return { ok: true, doc_url: doc.url, summary };
}

function addBatchMovements(movements) {
  if (!Array.isArray(movements) || !movements.length) {
    throw new Error("No movements to save");
  }

  movements.forEach(validateMovement);
  appendMovementRows(movements);

  const first = movements[0];
  const summary = getDailySummary(first.date, first.branch);
  const doc = upsertDailyReportDoc(first.date, first.branch, summary);
  sendBatchLineReport(movements, summary, doc.url);

  return { ok: true, saved: movements.length, doc_url: doc.url, summary };
}

function appendMovementRows(movements) {
  const sheet = getMovementSheet();
  const rows = movements.map((movement) => [
      new Date(),
      movement.date,
      movement.item_id || makeItemId(movement.item_name),
      movement.item_name,
      movement.stock_group || "raw_material",
      movement.movement_type,
      Number(movement.quantity),
      movement.unit,
      movement.branch,
      movement.note || "",
      movement.user
    ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
}

function compareUsage(params) {
  const sheet = getMovementSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const rows = values.map((row) => rowToObject(headers, row));

  const fromDate = params.from_date;
  const toDate = params.to_date;
  const branch = params.branch;
  const grouped = {};

  rows
    .filter((row) => row.date >= fromDate && row.date <= toDate && row.branch === branch)
    .forEach((row) => {
      const key = `${row.item_id}|${row.unit}`;
      if (!grouped[key]) {
        grouped[key] = {
          item_name: row.item_name,
          stock_group: row.stock_group || "raw_material",
          unit: row.unit,
          opening_stock: 0,
          receive: 0,
          closing_stock: 0
        };
      }

      if (row.movement_type === "opening_stock" && row.date === fromDate) {
        grouped[key].opening_stock += Number(row.quantity || 0);
      }

      if (row.movement_type === "receive") {
        grouped[key].receive += Number(row.quantity || 0);
      }

      if (row.movement_type === "closing_stock" && row.date === toDate) {
        grouped[key].closing_stock += Number(row.quantity || 0);
      }
    });

  const result = Object.values(grouped)
    .map((row) => ({
      ...row,
      usage: row.opening_stock + row.receive - row.closing_stock
    }))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  return { ok: true, rows: result };
}

function getSpreadsheet() {
  // Works for both standalone and container-bound scripts.
  // For a standalone script, set the target Sheet's ID in
  // Project Settings > Script Properties as SHEET_ID.
  const sheetId = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (sheetId) {
    return SpreadsheetApp.openById(sheetId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  throw new Error(
    "ไม่พบ Spreadsheet: ตั้งค่า SHEET_ID ใน Script Properties หรือสร้างสคริปต์จาก Extensions > Apps Script ภายใน Google Sheet"
  );
}

function getMovementSheet() {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    return sheet;
  }

  ensureHeaders(sheet);
  return sheet;
}

function validateMovement(movement) {
  const required = ["date", "item_name", "stock_group", "movement_type", "quantity", "unit", "branch", "user"];
  required.forEach((field) => {
    if (movement[field] === undefined || movement[field] === "") {
      throw new Error(`Missing field: ${field}`);
    }
  });

  const allowedTypes = ["opening_stock", "receive", "closing_stock", "adjustment", "waste"];
  if (!allowedTypes.includes(movement.movement_type)) {
    throw new Error("Invalid movement_type");
  }
}

function getDailySummary(date, branch) {
  const sheet = getMovementSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const rows = values.map((row) => rowToObject(headers, row));
  const grouped = {};

  rows
    .filter((row) => row.date === date && row.branch === branch)
    .forEach((row) => {
      const key = `${row.item_id}|${row.unit}`;
      if (!grouped[key]) {
        grouped[key] = {
          item_name: row.item_name,
          stock_group: row.stock_group || "raw_material",
          unit: row.unit,
          opening_stock: 0,
          receive: 0,
          adjustment: 0,
          waste: 0,
          closing_stock: null,
          remaining: 0,
          usage: 0
        };
      }

      const quantity = Number(row.quantity || 0);
      if (row.movement_type === "opening_stock") grouped[key].opening_stock += quantity;
      if (row.movement_type === "receive") grouped[key].receive += quantity;
      if (row.movement_type === "adjustment") grouped[key].adjustment += quantity;
      if (row.movement_type === "waste") grouped[key].waste += quantity;
      if (row.movement_type === "closing_stock") grouped[key].closing_stock = quantity;
    });

  return Object.values(grouped)
    .map((row) => {
      const calculated = row.opening_stock + row.receive + row.adjustment - row.waste;
      const remaining = row.closing_stock === null ? calculated : row.closing_stock;
      return {
        ...row,
        remaining,
        usage: calculated - remaining
      };
    })
    .sort((a, b) => `${a.stock_group}-${a.item_name}`.localeCompare(`${b.stock_group}-${b.item_name}`));
}

function upsertDailyReportDoc(date, branch, summary) {
  const title = `${DAILY_REPORT_PREFIX} - ${date} - ${branch}`;
  const files = DriveApp.getFilesByName(title);
  const doc = files.hasNext()
    ? DocumentApp.openById(files.next().getId())
    : DocumentApp.create(title);
  const body = doc.getBody();

  body.clear();
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`Updated: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")}`);
  body.appendParagraph("");
  body.appendParagraph("Daily Remaining Stock").setHeading(DocumentApp.ParagraphHeading.HEADING2);

  const table = body.appendTable([
    ["Group", "Item", "Opening", "Receive", "Adjust", "Waste", "Remaining", "Usage", "Unit"]
  ]);

  summary.forEach((row) => {
    const tableRow = table.appendTableRow();
    [
      row.stock_group,
      row.item_name,
      String(row.opening_stock),
      String(row.receive),
      String(row.adjustment),
      String(row.waste),
      String(row.remaining),
      String(row.usage),
      row.unit
    ].forEach((cell) => tableRow.appendTableCell(cell));
  });

  doc.saveAndClose();
  return { id: doc.getId(), url: doc.getUrl() };
}

function sendLineReport(movement, summary, docUrl) {
  const token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = PropertiesService.getScriptProperties().getProperty("LINE_GROUP_ID");

  if (!token || !groupId) {
    return;
  }

  const rawLines = summary
    .filter((row) => row.stock_group === "raw_material")
    .map((row) => `- ${row.item_name}: เหลือ ${row.remaining} ${row.unit}, ใช้ ${row.usage} ${row.unit}`);

  const wipLines = summary
    .filter((row) => row.stock_group === "wip")
    .map((row) => `- ${row.item_name}: เหลือ ${row.remaining} ${row.unit}, ใช้ ${row.usage} ${row.unit}`);

  const message = [
    "รายงานของเหลือประจำวัน",
    `วันที่: ${movement.date}`,
    `สาขา: ${movement.branch}`,
    `อัปเดตล่าสุด: ${movement.item_name} (${movement.movement_type}) ${movement.quantity} ${movement.unit}`,
    "",
    "Raw material",
    rawLines.length ? rawLines.join("\n") : "- ไม่มีข้อมูล",
    "",
    "WIP / Work in process",
    wipLines.length ? wipLines.join("\n") : "- ไม่มีข้อมูล",
    "",
    docUrl ? `Google Docs: ${docUrl}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text: message }]
    }),
    muteHttpExceptions: true
  });
}

function sendBatchLineReport(movements, summary, docUrl) {
  const token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = PropertiesService.getScriptProperties().getProperty("LINE_GROUP_ID");

  if (!token || !groupId) {
    return;
  }

  const first = movements[0];
  const groupLabel = first.stock_group === "wip" ? "WIP / Work in process" : "Raw material";
  const rawLines = summary
    .filter((row) => row.stock_group === "raw_material")
    .map((row) => `- ${row.item_name}: เหลือ ${row.remaining} ${row.unit}, ใช้ ${row.usage} ${row.unit}`);

  const wipLines = summary
    .filter((row) => row.stock_group === "wip")
    .map((row) => `- ${row.item_name}: เหลือ ${row.remaining} ${row.unit}, ใช้ ${row.usage} ${row.unit}`);

  const message = [
    "รายงาน Stock รายวัน",
    `วันที่: ${first.date}`,
    `สาขา: ${first.branch}`,
    `ผู้บันทึก: ${first.user}`,
    `หมวดที่บันทึก: ${groupLabel}`,
    `จำนวนรายการที่บันทึก: ${movements.length}`,
    "",
    "Raw material",
    rawLines.length ? rawLines.join("\n") : "- ไม่มีข้อมูล",
    "",
    "WIP / Work in process",
    wipLines.length ? wipLines.join("\n") : "- ไม่มีข้อมูล",
    "",
    docUrl ? `Google Docs: ${docUrl}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text: message }]
    }),
    muteHttpExceptions: true
  });
}

function ensureHeaders(sheet) {
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];

  if (!current[0]) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  if (!current.includes("stock_group")) {
    sheet.insertColumnAfter(4);
    sheet.getRange(1, 5).setValue("stock_group");
  }

  const updated = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  HEADERS.filter((header) => !updated.includes(header)).forEach((header) => {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
  });
}

function rowToObject(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = formatCell(row[index]);
    return object;
  }, {});
}

function formatCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value;
}

function makeItemId(itemName) {
  return String(itemName).trim().toLowerCase().replace(/\s+/g, "-");
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse(payload, callback) {
  const safeCallback = String(callback || "callback").replace(/[^\w.$]/g, "");
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)})`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
