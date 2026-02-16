window.ExpensAI.excel = {
  async exportExcelTemplate(){

    const expenses = window.ExpensAI.state.expenses;
    const selectedMonth = document.getElementById("monthSelect").value;

    if(!selectedMonth){
      alert("Seleziona un mese");
      return;
    }

    const monthExpenses = expenses.filter(e =>
      e.date && e.date.startsWith(selectedMonth)
    );

    if(monthExpenses.length === 0){
      alert("Nessuna spesa per questo mese");
      return;
    }

    // Carica il template dal progetto
    const response = await fetch("template.xlsx");
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheet = workbook.Sheets["Details"];
    if(!sheet){
      alert("Foglio 'Details' non trovato");
      return;
    }

    let row = 6; // riga iniziale scrittura

    monthExpenses.forEach(e => {
      XLSX.utils.sheet_add_aoa(sheet, [[
        e.date,
        e.desc,
        e.client,
        e.amount,
        e.seq || "",
        e.cat
      ]], { origin: `A${row}` });

      row++;
    });

    const newFile = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    });

    const blob = new Blob([newFile], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Notaspese_${selectedMonth}.xlsx`;
    link.click();
  }
};
