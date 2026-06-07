const config = window.STOCK_APP_CONFIG || {};
const apiUrl = config.API_URL || "";

const state = {
  category: "",
  user: "",
  date: "",
  branch: "สาขาหลัก"
};

const stockCatalog = {
  raw_material: {
    title: "นับ Stock รายวัน",
    eyebrow: "Raw Material",
    copy: "วัตถุดิบคงเหลือทั้งหมด เช่น เนื้อ หมู ไก่ กุ้ง ผัก เส้น เครื่องปรุง",
    items: [
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
      ["other_raw", "วัตถุดิบอื่นๆ", "หน่วย"]
    ]
  },
  wip: {
    title: "นับ Stock WIP รายวัน",
    eyebrow: "Work In Process",
    copy: "วัตถุดิบที่เตรียมแล้วหรือพร้อมขาย เช่น ของหมัก น้ำซุป ของจัดชุด",
    items: [
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
      ["other_wip", "WIP อื่นๆ", "หน่วย"]
    ]
  }
};

const views = {
  home: document.querySelector("#homeView"),
  user: document.querySelector("#userView"),
  count: document.querySelector("#countView"),
  report: document.querySelector("#reportView")
};

const toast = document.querySelector("#toast");
const statusEl = document.querySelector("#connectionStatus");
const userForm = document.querySelector("#userForm");
const batchForm = document.querySelector("#batchForm");
const compareForm = document.querySelector("#compareForm");
const usageRows = document.querySelector("#usageRows");
const itemList = document.querySelector("#itemList");

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
document.querySelector("#stockDate").value = today;
document.querySelector("#toDate").value = today;
document.querySelector("#fromDate").value = yesterday;

if (apiUrl) {
  statusEl.textContent = "พร้อมเชื่อมต่อ API";
  statusEl.classList.add("ready");
}

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    state.category = button.dataset.category;
    document.querySelector("#userViewTitle").textContent = `กรอกชื่อก่อน${stockCatalog[state.category].title}`;
    showView("user");
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.back));
});

userForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = getFormData(userForm);
  state.user = `${formData.first_name} ${formData.last_name}`.trim();
  state.date = formData.date;
  state.branch = formData.branch;
  renderCountForm();
  showView("count");
});

batchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const movements = collectMovements();

  if (!movements.length) {
    showToast("กรุณากรอกจำนวนอย่างน้อย 1 รายการ");
    return;
  }

  try {
    await callApi({ action: "addBatchMovements", movements });
    showToast(`บันทึก ${movements.length} รายการ และส่งรายงานแล้ว`);
    clearItemInputs();
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#clearItems").addEventListener("click", clearItemInputs);

compareForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const data = await callApi({
      action: "compareUsage",
      ...getFormData(compareForm)
    });
    renderUsageRows(data.rows);
  } catch (error) {
    showToast(error.message);
  }
});

function showView(name) {
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCountForm() {
  const catalog = stockCatalog[state.category];
  document.querySelector("#countEyebrow").textContent = catalog.eyebrow;
  document.querySelector("#countTitle").textContent = catalog.title;
  document.querySelector("#countMeta").textContent = `${catalog.copy} | ผู้บันทึก: ${state.user} | วันที่: ${state.date} | ${state.branch}`;

  itemList.innerHTML = catalog.items
    .map(([id, name, unit]) => {
      return `
        <article class="item-row" data-item-id="${escapeHtml(id)}" data-item-name="${escapeHtml(name)}">
          <div class="item-main">
            <strong>${escapeHtml(name)}</strong>
            <span>${catalog.eyebrow}</span>
          </div>
          <label>
            จำนวน
            <input class="item-quantity" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" />
          </label>
          <label>
            หน่วย
            <input class="item-unit" type="text" value="${escapeHtml(unit)}" />
          </label>
          <label class="item-note">
            หมายเหตุ
            <input class="item-note-input" type="text" placeholder="เช่น เหลือน้อย / ของเสีย / รับเข้า" />
          </label>
        </article>
      `;
    })
    .join("");
}

function collectMovements() {
  const movementType = document.querySelector("#movementType").value;
  return Array.from(document.querySelectorAll(".item-row"))
    .map((row) => {
      const quantityInput = row.querySelector(".item-quantity").value;
      return {
        has_quantity: quantityInput !== "",
        date: state.date,
        item_id: row.dataset.itemId,
        item_name: row.dataset.itemName,
        stock_group: state.category,
        movement_type: movementType,
        quantity: Number(quantityInput),
        unit: row.querySelector(".item-unit").value.trim(),
        branch: state.branch,
        note: row.querySelector(".item-note-input").value.trim(),
        user: state.user
      };
    })
    .filter((movement) => movement.has_quantity)
    .map(({ has_quantity, ...movement }) => movement);
}

function clearItemInputs() {
  document.querySelectorAll(".item-quantity, .item-note-input").forEach((input) => {
    input.value = "";
  });
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function callApi(payload) {
  if (!apiUrl) {
    throw new Error("กรุณาตั้งค่า API_URL ใน config.js ก่อนใช้งานจริง");
  }

  if (payload.action === "compareUsage") {
    return callJsonp(payload);
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  if (response.type === "opaque") {
    return { ok: true };
  }

  return response.json();
}

function callJsonp(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `stockCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(apiUrl);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("API timeout"));
    }, 12000);

    window[callbackName] = (data) => {
      cleanup();
      if (!data.ok) {
        reject(new Error(data.error || "API error"));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("โหลดข้อมูลจาก API ไม่สำเร็จ"));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function renderUsageRows(rows) {
  if (!rows.length) {
    usageRows.innerHTML = '<tr><td colspan="7" class="empty">ไม่พบข้อมูลในช่วงวันที่เลือก</td></tr>';
    return;
  }

  usageRows.innerHTML = rows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(formatStockGroup(row.stock_group))}</td>
          <td>${escapeHtml(row.item_name)}</td>
          <td>${formatNumber(row.opening_stock)}</td>
          <td>${formatNumber(row.receive)}</td>
          <td>${formatNumber(row.closing_stock)}</td>
          <td><strong>${formatNumber(row.usage)}</strong></td>
          <td>${escapeHtml(row.unit)}</td>
        </tr>
      `;
    })
    .join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3000);
}

function formatStockGroup(value) {
  return value === "wip" ? "WIP" : "Raw material";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
