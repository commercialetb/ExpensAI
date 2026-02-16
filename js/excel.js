(function () {
  const state = window.ExpensAI.state;

  // --- Helpers
  function monthKey(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return "";
    return dateStr.slice(0, 7); // YYYY-MM
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

  // Righe del tuo template (foglio "Details")
  const CATEGORY_SLOTS = {
    forfait:       { rows: [6] },
    pernottamento: { rows: [8, 9] },
    autoveicoli:   { rows: [11,12,13,14,15,16] },
    trasporto:     { rows: [18,19,20,21,22] },
    vitto_affari:  { rows: [24,25,26,27,28] },
    vitto_proprio: { rows: [30] },
    telefono:      { rows: [32] },
    ufficio:       { rows: [34,35] },
    altro:         { rows: [37,38] }
  };

  function clearData(details){
  const rowsToClear = [];
  Object.values(CATEGORY_SLOTS).forEach(v => v.rows.forEach(r => rowsToClear.push(r)));
  for (const r of rowsToClear){
    for (const c of ["B","C","D","E","F"]){
      details.cell(`${c}${r}`).value(null);
    }
  }
}

  function writeLine(details, row, e){
  // B = n°
  details.cell(`B${row}`).value(e.seq != null ? String(e.seq).padStart(3,"0") : "");

  // C = data
  details.cell(`C${row}`).value(e.date || "");

  // D = descrizione
  details.cell(`D${row}`).value(e.desc || "");

  // E = cliente / trasferta
  details.cell(`E${row}`).value(e.client || "");

  // F = importo
  const amt = (typeof e.amount === "number") ? e.amount : (parseFloat(e.amount)||0);
  details.cell(`F${row}`).value(amt);
}
  function safeName(name) {
    return (name || "Utente").replace(/[^\w\-]+/g, "_").slice(0, 40);
  }

  async function fetchTemplateArrayBuffer() {
    // IMPORTANT: path relativo (funziona su GitHub Pages)
    const res = await fetch("assets/template.xlsx", { cache: "no-store" });
    if (!res.ok) throw new Error(`Template non trovato: assets/template.xlsx (${res.status})`);
    return await res.arrayBuffer();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportExcelTemplate() {
    // Se non carichi da Firestore, state.expenses potrebbe essere vuoto.
    // In quel caso: premi "Aggiorna" e riprova.
    const expenses = Array.isArray(state.expenses) ? state.expenses : [];

    const monthInput = document.getElementById("monthSelect");
    const selectedMonth = (monthInput && monthInput.value) ? monthInput.value : "";
    const month = selectedMonth || (new Date().toISOString().slice(0, 7));

    // Filtra mese e ordina per seq
    const monthExpenses = expenses
      .filter(e => monthKey(e.date) === month)
      .sort((a, b) => (a.seq || 0) - (b.seq || 0));

    if (!monthExpenses.length) {
      // non blocco l’export, ma avviso (così capisci perché “vuoto”)
      // puoi commentarlo se preferisci
      console.warn("Nessuna spesa nel mese selezionato:", month);
    }

    // Carica template come base (mantiene tutte le formattazioni)
    const tpl = await fetchTemplateArrayBuffer();

    // XlsxPopulate in browser (da CDN)
    const wb = await window.XlsxPopulate.fromDataAsync(tpl);

    const details = wb.sheet("Details");
    if (!details) throw new Error("Foglio 'Details' non trovato nel template.");

    clearData(details);

    // Scrittura righe rispettando slot per categoria
    const counters = {};
    for (const e0 of monthExpenses) {
      const e = { ...e0, cat: normalizeCat(e0.cat) };
      const slots = CATEGORY_SLOTS[e.cat] || CATEGORY_SLOTS["altro"];
      counters[e.cat] = counters[e.cat] || 0;
      const i = counters[e.cat];
      if (i >= slots.rows.length) continue;
      writeLine(details, slots.rows[i], e);
      counters[e.cat] += 1;
    }

    // Output come Blob e download
    const out = await wb.outputAsync(); // Uint8Array
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const userName =
      (state.profile && state.profile.name) ||
      (state.user && state.user.displayName) ||
      "Utente";

    const filename = `Notaspese_${safeName(userName)}_${month}.xlsx`;
    downloadBlob(blob, filename);
  }

  window.ExpensAI = window.ExpensAI || {};
  window.ExpensAI.excel = window.ExpensAI.excel || {};
  window.ExpensAI.excel.exportExcelTemplate = exportExcelTemplate;
})();
