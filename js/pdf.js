(function(){
  const state = window.ExpensAI.state;

  function formatMonth(dateStr){
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  }

  async function makePdfBlob(dataUrl, meta){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:'pt', format:'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Add image, fit to page with margins
    const margin = 24;
    const maxW = pageW - margin*2;
    const maxH = pageH - margin*2;

    // We don't always know exact image dims; attempt using meta
    const iw = meta?.w || 1000;
    const ih = meta?.h || 1000;
    const ratio = Math.min(maxW/iw, maxH/ih);
    const w = iw*ratio;
    const h = ih*ratio;
    const x = (pageW - w)/2;
    const y = (pageH - h)/2;

    pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
    return pdf.output('blob');
  }

  async function saveReceiptPdf(expense){
    // Try to find a receipt image tied to this expense (local storage)
    let dataUrl = null;
    let meta = null;

    const stored = window.ExpensAI.localReceipts?.getForExpense?.(expense.id);
    if (stored?.dataUrl){
      dataUrl = stored.dataUrl;
      meta = stored.meta;
    } else if (state.lastReceiptDataUrl) {
      // fallback: latest scanned image
      dataUrl = state.lastReceiptDataUrl;
      meta = state.lastReceiptMeta;
    }

    // Requested UX: saving the receipt must NOT open pickers/menus.
    // If no receipt is already available, instruct the user to scan first.
    if (!dataUrl) throw new Error('Nessuna foto ricevuta: scansiona prima lo scontrino con “Scatta/Seleziona”.');

    const month = formatMonth(expense.date);
    const seqStr = String(expense.seq).padStart(3,'0');
    const fileName = `${month}_scontrino_${seqStr}.pdf`;

    const blob = await makePdfBlob(dataUrl, meta);
    const file = new File([blob], fileName, { type:'application/pdf' });

    // Try Web Share with file
    if (navigator.canShare && navigator.canShare({ files:[file] }) && navigator.share) {
      await navigator.share({
        title: 'Scontrino',
        text: `Salva in OneDrive: Spese/${month}/${fileName}`,
        files: [file]
      });
      return { fileName };
    }

    // Fallback (iOS/PWA friendly): open the PDF in a new tab so the user can tap Share and save to OneDrive/Files.
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      // If popup blocked, fallback to a normal download
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Keep URL alive a bit longer for iOS
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
    return { fileName };
  }

  window.ExpensAI.pdf = { saveReceiptPdf };
})();
