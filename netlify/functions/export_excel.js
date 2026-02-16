const fs = require("fs");
const path = require("path");
const XlsxPopulate = require("xlsx-populate");

// Robust monthKey: supports ISO strings (YYYY-MM-DD), timestamps, and other parseable formats
function monthKey(dateStr) {
  if (!dateStr) return "";

  // If it's already ISO-like YYYY-MM...
  if (typeof dateStr === "string" && /^\d{4}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 7);
  }

  // If it's a number (timestamp)
  if (typeof dateStr === "number") {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${yyyy}-${mm}`;
    }
    return "";
  }

  // Try parsing generic string
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }

  return "";
}

function normalizeCat(raw) {
  const s = (raw || "").toLowerCase();
  if (s.includes("perno")) return "pernottamento";
  if (s.includes("auto") || s.includes("kfz")) return "autoveicoli";
  if (s.includes("trasp") || s.includes("mezzi")) return "trasporto";
  if (s.includes("telefono") || s.includes("internet")) return "telefono";
  if (s.includes("ufficio") || s.includes("materiale")) return "ufficio";
  if (s.includes("forfait") || s.includes("diät") || s.includes("dieta")) return "forfait";
  if (s.includes("vitto") && s.includes("aff")) return "vitto_affari";
  if (s === "vitto" || s.includes("ristor") || s.includes("bar")) return "vitto_affari";
  return "altro";
}

// Template row mapping (based on your workbook layout)
const CATEGORY_SLOTS = {
  forfait: { rows: [6] },
  pernottamento: { rows: [8, 9] },
  autoveicoli: { rows: [11, 12, 13, 14, 15, 16] },
  trasporto: { rows: [18, 19, 20, 21, 22] },
  vitto_affari: { rows: [24, 25, 26, 27, 28] },
  vitto_proprio: { rows: [30] },
  telefono: { rows: [32] },
  ufficio: { rows: [34, 35] },
  altro: { rows: [37, 38] },
};

function clearData(details) {
  // Clear typical data rows while keeping styles (only values)
  const rowsToClear = [];
  Object.values(CATEGORY_SLOTS).forEach((v) => v.rows.forEach((r) => rowsToClear.push(r)));

  for (const r of rowsToClear) {
    for (const c of ["A", "B", "C", "D", "E", "F"]) {
      details.cell(`${c}${r}`).value(null);
    }
  }
}

function writeLine(details, row, e) {
  // IMPORTANT: write only values; styles come from template
  details.cell(`A${row}`).value(e.date || "");
  details.cell(`B${row}`).value(e.desc || e.description || "");
  details.cell(`C${row}`).value(e.client || e.trip || "");
  const amt = typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0;
  details.cell(`D${row}`).value(amt);
  details.cell(`E${row}`).value(e.seq != null ? String(e.seq).padStart(3, "0") : "");
  details.cell(`F${row}`).value(e.cat || e.category || "");
}

function pickTemplatePath() {
  const candidates = [
    path.join(__dirname, "template.xlsx"),
    path.join(process.cwd(), "netlify", "functions", "template.xlsx"),
    "/var/task/netlify/functions/template.xlsx",
    "/var/task/.netlify/functions/template.xlsx",
  ];

  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.R_OK);
      return p;
    } catch (_) {}
  }
  return null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const payload = JSON.parse(event.body || "{}");

    const userName = payload.userName || "Utente";
    const selectedMonth = payload.selectedMonth || "";

    // Accept multiple payload keys to avoid empty exports
    const expenses =
      Array.isArray(payload.expenses) ? payload.expenses :
      Array.isArray(payload.items) ? payload.items :
      Array.isArray(payload.rows) ? payload.rows :
      [];

    const month = selectedMonth || new Date().toISOString().slice(0, 7);

    // Robust filter by month (supports ISO and parseable strings)
    const monthExpenses = expenses
      .filter((e) => monthKey(e.date) === month)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0));

    const templatePath = pickTemplatePath();
    if (!templatePath) {
      const dirList = (() => {
        try { return fs.readdirSync(__dirname); } catch (e) { return ["(cannot read __dirname)"]; }
      })();
      throw new Error(
        `Template non trovato. __dirname=${__dirname} cwd=${process.cwd()} dir=${JSON.stringify(dirList)}`
      );
    }

    const wb = await XlsxPopulate.fromFileAsync(templatePath);
    const details = wb.sheet("Details");
    if (!details) throw new Error("Foglio 'Details' non trovato nel template.");

    clearData(details);

    const counters = {};
    for (const e of monthExpenses) {
      const cat = normalizeCat(e.cat || e.category);
      const slots = CATEGORY_SLOTS[cat] || CATEGORY_SLOTS["altro"];
      counters[cat] = counters[cat] || 0;

      const i = counters[cat];
      if (i >= slots.rows.length) continue; // overflow ignored (can be extended later)

      const row = slots.rows[i];
      writeLine(details, row, e);
      counters[cat] += 1;
    }

    // Optional: stamp month somewhere if template has it (safe try)
    try { details.cell("B2").value(month); } catch (_) {}

    const outData = await wb.outputAsync({ type: "nodebuffer" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Notaspese_${userName.replace(/\s+/g, "_")}_${month}.xlsx"`,
        "Cache-Control": "no-store",
      },
      body: outData.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: `Export error: ${err.message || err}` };
  }
};
