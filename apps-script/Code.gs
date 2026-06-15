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

    if (body.action === "addSnapshot") {
      return jsonResponse(addSnapshot(body));
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

// ---- Wide snapshot model (one row per submission) -------------------------
// Raw material and WIP are written to separate tabs. Items flagged hasImage
// get a photo uploaded to Drive, with the share link stored in the next column.

var SNAPSHOT_TABS = { raw_material: "raw_material", wip: "wip", import: "import" };

function addSnapshot(payload) {
  var group = SNAPSHOT_TABS[payload.stock_group] ? payload.stock_group : "raw_material";
  var items = payload.items || [];
  if (!items.length) {
    throw new Error("ไม่มีรายการสินค้า");
  }
  if (!payload.date || !payload.user) {
    throw new Error("กรุณาระบุวันที่และชื่อผู้บันทึก");
  }

  var ss = getSpreadsheet();
  var sheetName = SNAPSHOT_TABS[group];
  var sheet = ss.getSheetByName(sheetName);

  // Build the header from the item list (timestamp, date, user, then each
  // item as "name (unit)" + an "แนบรูปประกอบ" column when it has an image).
  var header = ["ประทับเวลา", "วันที่กรอกข้อมูล", "ชื่อผู้กรอก / ผู้ตรวจนับ"];
  items.forEach(function (it) {
    header.push(it.unit ? it.name + " (" + it.unit + ")" : it.name);
    if (it.hasImage) header.push("แนบรูปประกอบ");
  });

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(header);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
  }

  // Build the data row in the same order as the header.
  var row = [new Date(), payload.date, payload.user];
  var savedCount = 0;
  items.forEach(function (it) {
    var hasQty = it.quantity !== "" && it.quantity !== null && it.quantity !== undefined;
    row.push(hasQty ? Number(it.quantity) : "");
    if (hasQty) savedCount++;
    if (it.hasImage) {
      var link = "";
      if (it.image) {
        link = saveImageToDrive(it.image, payload.date + " - " + it.name + " - " + payload.user);
      }
      row.push(link);
    }
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return { ok: true, saved: savedCount, sheet: sheetName };
}

function saveImageToDrive(dataUrl, name) {
  var match = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return "";
  var contentType = match[1];
  var bytes = Utilities.base64Decode(match[2]);
  var ext = contentType.indexOf("png") !== -1 ? ".png" : ".jpg";
  var blob = Utilities.newBlob(bytes, contentType, name + ext);
  var folder = getPhotoFolder();
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Sharing may be restricted by the Workspace domain; the link is still
    // stored and accessible to anyone the file is shared with.
  }
  return file.getUrl();
}

function getPhotoFolder() {
  var name = "Stock Photos";
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

// ===========================================================================
// REPORT TABS — run setupReports() once from the editor to (re)build them.
// They use LIVE formulas referencing the data tabs (raw_material, wip, import)
// plus two input tabs you fill in: sales_daily and expected_usage.
// Re-run any time after adding new items; it reads item names from the data
// tab headers so it stays in sync. Save at least one row in each section first.
// ===========================================================================

var REPORT_MAX_ROW = 2000; // bounded range for FILTER performance

function setupReports() {
  var ss = getSpreadsheet();
  ensureInputTabs_(ss);
  buildDashboard_(ss);
  buildUsageReport_(ss);
  buildDefectsReport_(ss);
  buildStockRemaining_(ss);
  return { ok: true, message: "Report tabs created/updated" };
}

function ensureInputTabs_(ss) {
  if (!ss.getSheetByName("sales_daily")) {
    var s = ss.insertSheet("sales_daily");
    s.getRange(1, 1, 1, 3).setValues([
      ["date (yyyy-mm-dd)", "ยอดขาย (บาท)", "จำนวนลูกค้า"],
    ]);
    s.setFrozenRows(1);
  }
  if (!ss.getSheetByName("expected_usage")) {
    var e = ss.insertSheet("expected_usage");
    e.getRange(1, 1, 1, 3).setValues([
      ["date (yyyy-mm-dd)", "item (ชื่อ + หน่วย ตรงกับหัวคอลัมน์ raw_material)", "expected_usage (จากระบบ POS)"],
    ]);
    e.setFrozenRows(1);
  }
}

// Reads the item column headers of a data tab, skipping the 3 meta columns
// and any "แนบรูปประกอบ" image columns.
function readItemHeaders_(ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastColumn() < 4) return [];
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var items = [];
  for (var c = 3; c < hdr.length; c++) {
    var name = String(hdr[c]).trim();
    if (!name || name === "แนบรูปประกอบ") continue;
    items.push(name);
  }
  return items;
}

function resetSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (sh) sh.clear();
  else sh = ss.insertSheet(name);
  return sh;
}

// Latest value for an item on a specific date in a wide data tab.
function fLatestOnDate_(tab, itemRef, dateRef) {
  return (
    "=IFERROR(INDEX(" + tab + "!$A:$ZZ, MAX(FILTER(ROW(" + tab + "!$B$2:$B$" + REPORT_MAX_ROW +
    "), " + tab + "!$B$2:$B$" + REPORT_MAX_ROW + "=" + dateRef + ")), MATCH(" + itemRef + ", " + tab + "!$1:$1, 0)),0)"
  );
}

// Latest value for an item across all dates (most recent row).
function fLatestAny_(tab, itemRef) {
  return (
    "=IFERROR(INDEX(" + tab + "!$A:$ZZ, MAX(FILTER(ROW(" + tab + "!$B$2:$B$" + REPORT_MAX_ROW +
    "), " + tab + "!$B$2:$B$" + REPORT_MAX_ROW + "<>\"\")), MATCH(" + itemRef + ", " + tab + "!$1:$1, 0)),0)"
  );
}

function buildDashboard_(ss) {
  var sh = resetSheet_(ss, "dashboard");
  sh.getRange("A1").setValue("วันที่ (yyyy-mm-dd)");
  sh.getRange("B1").setFormula('=TEXT(TODAY(),"yyyy-mm-dd")');
  sh.getRange("A2").setValue("วันก่อนหน้า");
  sh.getRange("B2").setFormula('=TEXT(DATEVALUE($B$1)-1,"yyyy-mm-dd")');

  var labels = [
    "ยอดขาย (บาท)",
    "จำนวนลูกค้า",
    "จำนวนรายการผิดปกติ (≥10%)",
    "รวมใช้จริง (นับ)",
    "รวมใช้ตามระบบ (POS)",
  ];
  var formulas = [
    "=IFERROR(SUMIF(sales_daily!$A:$A,$B$1,sales_daily!$B:$B),0)",
    "=IFERROR(SUMIF(sales_daily!$A:$A,$B$1,sales_daily!$C:$C),0)",
    '=COUNTIF(usage_rm!$H:$H,"⚠️")',
    "=SUM(usage_rm!$E:$E)",
    "=SUM(usage_rm!$F:$F)",
  ];
  sh.getRange(4, 1, labels.length, 1).setValues(labels.map(function (l) { return [l]; }));
  sh.getRange(4, 2, formulas.length, 1).setFormulas(formulas.map(function (f) { return [f]; }));
  sh.setColumnWidth(1, 230);
  sh.getRange("A4:A8").setFontWeight("bold");
}

function buildUsageReport_(ss) {
  var sh = resetSheet_(ss, "usage_rm");
  sh.getRange("A1").setValue("วันที่ (yyyy-mm-dd)");
  sh.getRange("B1").setFormula("=dashboard!$B$1");
  sh.getRange("A2").setValue("วันก่อนหน้า");
  sh.getRange("B2").setFormula('=TEXT(DATEVALUE($B$1)-1,"yyyy-mm-dd")');

  var headers = ["สินค้า", "คงเหลือเมื่อวาน", "รับเข้า", "คงเหลือวันนี้", "ใช้จริง (นับ)", "ใช้ตามระบบ (POS)", "%ต่าง", "ผิดปกติ"];
  sh.getRange(4, 1, 1, headers.length).setValues([headers]);
  sh.getRange(4, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(4);

  var items = readItemHeaders_(ss, "raw_material");
  if (!items.length) {
    sh.getRange(5, 1).setValue("ยังไม่มีข้อมูล raw_material — บันทึก Stock รายวันก่อน แล้วรัน setupReports อีกครั้ง");
    return;
  }

  var start = 5;
  sh.getRange(start, 1, items.length, 1).setValues(items.map(function (n) { return [n]; }));

  var fB = [], fC = [], fD = [], fE = [], fF = [], fG = [], fH = [];
  for (var i = 0; i < items.length; i++) {
    var r = start + i;
    var nm = "$A" + r;
    fB.push([fLatestOnDate_("raw_material", nm, "$B$2")]);
    fC.push(["=IFERROR(SUMIF(import!$B:$B,$B$1, INDEX(import!$A:$ZZ,0,MATCH(" + nm + ", import!$1:$1,0))),0)"]);
    fD.push([fLatestOnDate_("raw_material", nm, "$B$1")]);
    fE.push(["=$B" + r + "+$C" + r + "-$D" + r]);
    fF.push(["=IFERROR(SUMIFS(expected_usage!$C:$C, expected_usage!$A:$A, $B$1, expected_usage!$B:$B, " + nm + "),0)"]);
    fG.push(["=IF($F" + r + "=0,\"\",ABS($E" + r + "-$F" + r + ")/$F" + r + ")"]);
    fH.push(["=IF(AND($F" + r + "<>0,$G" + r + ">=0.1),\"⚠️\",\"\")"]);
  }
  sh.getRange(start, 2, items.length, 1).setFormulas(fB);
  sh.getRange(start, 3, items.length, 1).setFormulas(fC);
  sh.getRange(start, 4, items.length, 1).setFormulas(fD);
  sh.getRange(start, 5, items.length, 1).setFormulas(fE);
  sh.getRange(start, 6, items.length, 1).setFormulas(fF);
  sh.getRange(start, 7, items.length, 1).setFormulas(fG);
  sh.getRange(start, 8, items.length, 1).setFormulas(fH);
  sh.getRange(start, 7, items.length, 1).setNumberFormat("0.0%");
  sh.setColumnWidth(1, 240);
}

function buildDefectsReport_(ss) {
  var sh = resetSheet_(ss, "defects");
  sh.getRange("A1").setValue("สรุปของเสีย (Defects)");
  sh.getRange("A2").setValue("วันที่ (yyyy-mm-dd)");
  sh.getRange("B2").setFormula("=dashboard!$B$1");
  sh.getRange(4, 1, 1, 3).setValues([["รายการของเสีย", "ปริมาณวันนี้", "รวมสะสมทั้งหมด"]]);
  sh.getRange(4, 1, 1, 3).setFontWeight("bold");

  var items = readItemHeaders_(ss, "wip").filter(function (n) { return n.indexOf("ของเสีย") === 0; });
  var start = 5;
  if (!items.length) {
    sh.getRange(start, 1).setValue("ยังไม่มีข้อมูลของเสียใน wip — บันทึก WIP ก่อน แล้วรัน setupReports อีกครั้ง");
    return;
  }
  sh.getRange(start, 1, items.length, 1).setValues(items.map(function (n) { return [n]; }));
  var fB = [], fC = [];
  for (var i = 0; i < items.length; i++) {
    var r = start + i;
    var nm = "$A" + r;
    fB.push([fLatestOnDate_("wip", nm, "$B$2")]);
    fC.push(["=IFERROR(SUM(INDEX(wip!$A:$ZZ,0,MATCH(" + nm + ", wip!$1:$1,0))),0)"]);
  }
  sh.getRange(start, 2, items.length, 1).setFormulas(fB);
  sh.getRange(start, 3, items.length, 1).setFormulas(fC);
  sh.setColumnWidth(1, 240);
}

function buildStockRemaining_(ss) {
  var sh = resetSheet_(ss, "stock_remaining");
  sh.getRange("A1").setValue("คงเหลือล่าสุด (Stock Remaining)");

  var rm = readItemHeaders_(ss, "raw_material");
  sh.getRange(3, 1, 1, 2).setValues([["RM — วัตถุดิบคงเหลือ", "คงเหลือ"]]);
  sh.getRange(3, 1, 1, 2).setFontWeight("bold");
  var r = 4;
  if (rm.length) {
    sh.getRange(r, 1, rm.length, 1).setValues(rm.map(function (n) { return [n]; }));
    var f = [];
    for (var i = 0; i < rm.length; i++) {
      f.push([fLatestAny_("raw_material", "$A" + (r + i))]);
    }
    sh.getRange(r, 2, rm.length, 1).setFormulas(f);
    r = r + rm.length + 2;
  } else {
    sh.getRange(r, 1).setValue("ยังไม่มีข้อมูล raw_material");
    r = r + 2;
  }

  var wip = readItemHeaders_(ss, "wip");
  sh.getRange(r, 1, 1, 2).setValues([["WIP — คงเหลือ", "คงเหลือ"]]);
  sh.getRange(r, 1, 1, 2).setFontWeight("bold");
  var wr = r + 1;
  if (wip.length) {
    sh.getRange(wr, 1, wip.length, 1).setValues(wip.map(function (n) { return [n]; }));
    var fw = [];
    for (var i = 0; i < wip.length; i++) {
      fw.push([fLatestAny_("wip", "$A" + (wr + i))]);
    }
    sh.getRange(wr, 2, wip.length, 1).setFormulas(fw);
  } else {
    sh.getRange(wr, 1).setValue("ยังไม่มีข้อมูล wip");
  }
  sh.setColumnWidth(1, 240);
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
