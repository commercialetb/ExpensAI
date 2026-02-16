// js/excel.js
(function () {
  window.ExpensAI = window.ExpensAI || {};
  window.ExpensAI.excel = window.ExpensAI.excel || {};

  // Questa è la funzione che il tuo UI sta chiamando
  window.ExpensAI.excel.exportExcelTemplate = async function () {
    try {
      // prendi le spese salvate (adatta la key se nel tuo state è diversa)
      const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");

      const res = await fetch("/.netlify/functions/export_excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || ("HTTP " + res.status));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Notaspese.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export Excel: " + (e?.message || e));
    }
  };
})();
