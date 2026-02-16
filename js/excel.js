// js/excel.js
(function () {
  // crea namespace in modo sicuro (anche se qualche file lo resetta)
  window.ExpensAI = window.ExpensAI || {};
  window.ExpensAI.excel = window.ExpensAI.excel || {};

  async function exportExcelTemplate() {
    const state = window.ExpensAI.state || {};
    const monthInput = document.getElementById("monthSelect");
    const selectedMonth = state.selectedMonth || monthInput?.value || new Date().toISOString().slice(0, 7);

    const userName =
      state.user?.name ||
      document.getElementById("userLabel")?.textContent ||
      "Utente";

    const expenses = Array.isArray(state.expenses) ? state.expenses : [];
    if (!expenses.length) {
      alert("Nessuna spesa da esportare.");
      return;
    }

    // Normalizza le date (IMPORTANTISSIMO se arrivano da Firestore Timestamp)
    const normalized = expenses.map(e => {
      let d = e.date;
      if (d && typeof d === "object" && (d.seconds || d._seconds)) {
        const sec = d.seconds || d._seconds;
        d = new Date(sec * 1000).toISOString().slice(0, 10);
      }
      if (d instanceof Date) d = d.toISOString().slice(0, 10);
      return { ...e, date: (typeof d === "string" ? d : "") };
    });

    const res = await fetch("/.netlify/functions/export_excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, selectedMonth, expenses: normalized })
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Errore server export");
    }

    const blob = await res.blob();
    const fileName = `Notaspese_${userName.replace(/\s+/g, "_")}_${selectedMonth}.xlsx`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ESPONE la funzione
  window.ExpensAI.excel.exportExcelTemplate = exportExcelTemplate;

  // Debug utile: puoi vedere da console se è stata caricata
  window.ExpensAI.excel.__loaded = true;
})();
