const fs = require("fs");
const path = require("path");
const XlsxPopulate = require("xlsx-populate");

function monthKey(dateStr){
  if(!dateStr || typeof dateStr !== "string") return "";
  return dateStr.slice(0,7);
}
function normalizeCat(raw){
  const s = (raw||"").toLowerCase();
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

const CATEGORY_SLOTS = {
  forfait:       { rows:[6] },
  pernottamento: { rows:[8,9] },
  autoveicoli:   { rows:[11,12,13,14,15,16] },
  trasporto:     { rows:[18,19,20,21,22] },
  vitto_affari:  { rows:[24,25,26,27,28] },
  vitto_proprio: { rows:[30] },
  telefono:      { rows:[32] },
  ufficio:       { rows:[34,35] },
  altro:         { rows:[37,38] }
};

function clearData(details){
  const rowsToClear = [];
  Object.values(CATEGORY_SLOTS).forEach(v => v.rows.forEach(r => rowsToClear.push(r)));
  for (const r of rowsToClear){
    for (const c of ["A","B","C","D","E","F"]){
      details.cell(`${c}${r}`).value(null);
    }
  }
}

function writeLine(details, row, e){
  details.cell(`A${row}`).value(e.date || "");
  details.cell(`B${row}`).value(e.desc || "");
  details.cell(`C${row}`).value(e.client || "");
  const amt = (typeof e.amount === "number") ? e.amount : (parseFloat(e.amount)||0);
  details.cell(`D${row}`).value(amt);
  details.cell(`E${row}`).value(e.seq != null ? String(e.seq).padStart(3,"0") : "");
  details.cell(`F${row}`).value(e.cat || "");
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const payload = JSON.parse(event.body || "{}");
    const userName = payload.userName || "Utente";
    const selectedMonth = payload.selectedMonth || "";
    const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];

    const month = selectedMonth || (new Date().toISOString().slice(0,7));
    const monthExpenses = expenses.filter(e => monthKey(e.date) === month).sort((a,b)=>(a.seq||0)-(b.seq||0));

const candidates = [
  path.join(__dirname, "template.xlsx"),
  path.join(process.cwd(), "netlify", "functions", "template.xlsx"),
  "/var/task/netlify/functions/template.xlsx",
  "/var/task/.netlify/functions/template.xlsx",
];

let templatePath = null;
for (const p of candidates) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    templatePath = p;
    break;
  } catch (_) {}
}

if (!templatePath) {
  const dirList = (() => { try { return fs.readdirSync(__dirname); } catch(e){ return ["(cannot read __dirname)"]; }})();
  throw new Error(
    `Template non trovato. __dirname=${__dirname} cwd=${process.cwd()} dir=${JSON.stringify(dirList)} candidates=${JSON.stringify(candidates)}`
  );
}
    const wb = await XlsxPopulate.fromFileAsync(templatePath);
    const details = wb.sheet("Details");
    if (!details) throw new Error("Foglio 'Details' non trovato nel template.");

    clearData(details);

    const counters = {};
    for (const e of monthExpenses){
      const cat = normalizeCat(e.cat);
      const slots = CATEGORY_SLOTS[cat] || CATEGORY_SLOTS["altro"];
      counters[cat] = counters[cat] || 0;
      const i = counters[cat];
      if (i >= slots.rows.length) continue;
      const row = slots.rows[i];
      writeLine(details, row, e);
      counters[cat] += 1;
    }

    const outData = await wb.outputAsync({ type: "nodebuffer" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Notaspese_${userName.replace(/\s+/g,'_')}_${month}.xlsx"`,
        "Cache-Control": "no-store"
      },
      body: outData.toString("base64"),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: `Export error: ${err.message || err}` };
  }
};
