(function(){
  if (!window.ExpensAI) window.ExpensAI = {};

  const state = {
    user: null,          // {uid, name, employeeId}
    budget: 1500,
    selectedMonth: '2026-02', // YYYY-MM reference month
    expenses: [],        // array of {id, seq, date, amount, desc, client, cat, receiptSaved, receiptFileName}
    lastReceiptDataUrl: null, // image dataURL from latest scan (for PDF)
    lastReceiptMeta: null,    // {w,h}
    groqKey: '',
    groqOnline: null,
    unsubExpenses: null
  };

  window.ExpensAI.state = state;
})();
