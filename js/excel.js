// js/excel.js
(function () {

  // Assicuriamo struttura globale stabile
  if (!window.ExpensAI) window.ExpensAI = {};
  if (!window.ExpensAI.excel) window.ExpensAI.excel = {};

  function getExpenses() {
    if (window.ExpensAI.state && Array.isArray(window.ExpensAI.state.expenses)) {
      return window.ExpensAI.state.expenses;
    }
    return [];
  }

  async function exportExcelTemplate() {
    try {

      const state = window.ExpensAI.state || {};
      const expenses = getExpenses();

      if (!expenses.length) {
        alert("Nessuna spesa da esportare.");
        return;
      }

      const selectedMonth =
        state.selectedMonth ||
        document.getElementById("monthSelect")?.value ||
        new Date().toISOString().slice(0,7);

      const userName =
        state.user?.name ||
        document.getElementById("userLabel")?.textContent ||
        "Utente";

      const res = await fetch("/.netlify/functions/export_excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          selectedMonth,
          expenses
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Errore server");
      }

      const blob = await res.blob();
      const fileName = `Notaspese_${userName.replace(/\s+/g,"_")}_${selectedMonth}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

    } catch (err) {
      alert("Export Excel: " + (err.message || err));
      console.error(err);
    }
  }

  // ASSEGNAZIONE SICURA
  window.ExpensAI.excel.exportExcelTemplate = exportExcelTemplate;

})();
