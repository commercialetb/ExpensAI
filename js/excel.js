window.ExpensAI = window.ExpensAI || {};
window.ExpensAI.excel = window.ExpensAI.excel || {};

window.ExpensAI.excel.exportExcelTemplate = async function(){
  try{
    const state = window.ExpensAI.state || {};
    const month = state.selectedMonth || (new Date().toISOString().slice(0,7));
    const userName = (state.user && state.user.name) ? state.user.name : "Utente";

    const payload = { userName, selectedMonth: month, expenses: state.expenses || [] };

    const res = await fetch("/.netlify/functions/export_excel", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      const t = await res.text();
      throw new Error(t || ("HTTP " + res.status));
    }

    const blob = await res.blob();
    const fileName = `Notaspese_${userName.replace(/\s+/g,'_')}_${month}.xlsx`;
    const file = new File([blob], fileName, { type: blob.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }catch(err){
    alert("❌ Export Excel: " + (err.message || err));
    console.warn(err);
  }
};