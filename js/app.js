(function(){
  const state = window.ExpensAI.state;
  const { auth } = window.ExpensAI.firebase;

  const $ = (id)=>document.getElementById(id);

  function showRegister(){ $('loginScreen').classList.add('hidden'); $('registerScreen').classList.remove('hidden'); }
  function showLogin(){ $('registerScreen').classList.add('hidden'); $('loginScreen').classList.remove('hidden'); }

  function monthKey(dateStr){
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function setDupHint(txt){ $('dupHint').textContent = txt; }

  async function onScan(file){
    $('loader').classList.remove('hidden');
    try{
      const data = await window.ExpensAI.ai.scanReceipt(file);
      $('fDate').value = data.date;
      $('fAmount').value = data.amount;
      $('fDesc').value = data.desc;
      $('fClient').value = data.client;
      $('fCat').value = data.cat;

      const dup = window.ExpensAI.ai.findDuplicate(data, state.expenses);
      if (dup){
        setDupHint(`⚠️ Possibile duplicato: #${String(dup.seq).padStart(3,'0')} · ${dup.date} · ${Number(dup.amount).toFixed(2)}€`);
      } else {
        setDupHint('✅ Nessun duplicato rilevato');
      }
    } catch(err){
      alert('❌ ' + (err?.message || err));
    } finally {
      $('loader').classList.add('hidden');
    }
  }

  async function onSaveExpense(){
    const date = $('fDate').value || new Date().toISOString().slice(0,10);
    const amount = Number($('fAmount').value||0);
    const desc = ($('fDesc').value||'').trim();
    const client = ($('fClient').value||'').trim();
    const cat = $('fCat').value;

    if (!amount || amount<=0){ alert('Inserisci un importo valido'); return; }

    const cand = {date, amount, desc, client, cat};
    const dup = window.ExpensAI.ai.findDuplicate(cand, state.expenses);
    if (dup){
      const ok = confirm(`Possibile duplicato con #${String(dup.seq).padStart(3,'0')} (${dup.date} - ${dup.amount}€).\nVuoi salvare comunque?`);
      if (!ok) return;
    }

    try{
      const {seq, id} = await window.ExpensAI.firestore.addExpense({date, amount, desc, client, cat});
      const month = monthKey(date);
      const fileName = `${month}_scontrino_${String(seq).padStart(3,'0')}.pdf`;
      await window.ExpensAI.firestore.updateExpense(id, { receiptFileName: fileName });

      // Persist the last scanned receipt locally and bind it to this expense id.
      // This makes "Salva ricevuta (PDF)" work even after a refresh or later.
      try{ await window.ExpensAI.localReceipts?.attachToExpense?.(id); }catch{}

      // Optimistic UI update so totals/alerts update immediately (Firestorm listener can lag on iOS/PWA)
      try{
        state.expenses = [{
          id,
          seq,
          date,
          amount,
          desc,
          client,
          cat,
          receiptSaved: false,
          receiptFileName: fileName
        }, ...state.expenses.filter(e=>e.id!==id)];
        window.ExpensAI.ui?.renderExpenses?.();
        window.ExpensAI.ui?.renderAlerts?.();
      }catch{}

      alert(`✅ Spesa salvata (#${String(seq).padStart(3,'0')}). Ora premi "Salva ricevuta (PDF)" dalla lista per salvarla in OneDrive (Spese/${month}/…).`);

      // clear form fields but keep last scan image in memory for the PDF
      // (so user can immediately save PDF for the last expense)
      $('fAmount').value='';
      $('fDesc').value='';
      $('fClient').value='';
      setDupHint('Duplicati: —');
    } catch(err){
      alert('❌ ' + (err?.message || err));
    }
  }

  async function onSaveBudget(){
    try{
      const b = Number($('budget').value||1500);
      await window.ExpensAI.firestore.saveBudget(b);
      alert('✅ Budget aggiornato');
      window.ExpensAI.ui.renderAlerts();
    }catch(e){ alert('❌ ' + (e?.message||e)); }
  }

  async function onSaveKey(){
    const key = ($('groqKey').value||'').trim();
    if (!state.user?.uid){ alert('Non loggato'); return; }
    localStorage.setItem(`groq_${state.user.uid}`, key);
    state.groqKey = key;
    $('groqStatus').textContent = 'Stato: (salvata)';
    alert('✅ Chiave salvata in questo dispositivo');
  }

  async function onTestKey(){
    try{
      $('groqStatus').textContent = 'Stato: test in corso…';
      await window.ExpensAI.ai.testGroqKey();
      $('groqStatus').textContent = 'Stato: ✅ Online';
    } catch(e){
      $('groqStatus').textContent = 'Stato: ❌ Errore';
      alert('❌ Test fallito: ' + (e?.message||e));
    }
  }

  function bindUI(){
    $('btnGoRegister').onclick = showRegister;
    $('btnBackToLogin').onclick = showLogin;

    $('btnRegister').onclick = async ()=>{
      const name = $('regName').value.trim();
      const id = $('regID').value.trim();
      const pin = $('regPIN').value.trim();
      if (!name || !id || pin.length!==4){ alert('Compila tutti i campi (PIN 4 cifre)'); return; }
      try{
        await window.ExpensAI.auth.register(name, id, pin);
        alert('✅ Account creato! Ora sei loggato.');
      }catch(e){
        const code = e?.code||'';
        if (code.includes('email-already-in-use')) alert('⚠️ Utente già esistente. Vai su login.');
        else alert('❌ Registrazione fallita: ' + (e?.message||e));
      }
    };

    $('btnLogin').onclick = async ()=>{
      const name = $('loginName').value.trim();
      const id = $('loginID').value.trim();
      const pin = $('loginPIN').value.trim();
      if (!name || !id || pin.length!==4){ alert('Compila tutti i campi (PIN 4 cifre)'); return; }
      try{
        await window.ExpensAI.auth.login(name, id, pin);
      } catch(e){
        alert('❌ Login fallito: ' + (e?.message||e));
      }
    };

    $('btnLogout').onclick = async ()=>{
      try{ await window.ExpensAI.auth.logout(); }catch{}
    };

    $('btnRefresh').onclick = ()=>{
      // Force a fresh read (helpful on iOS Safari/PWA)
      window.ExpensAI.firestore.refreshNow?.().catch(()=>{});
      window.ExpensAI.ui.renderExpenses();
      window.ExpensAI.ui.renderAlerts();
    };

    $('receiptInput').addEventListener('change', (e)=>{
      const f = e.target.files?.[0];
      if (f) onScan(f);
      e.target.value='';
    });

    // Optional library picker (without forcing camera)
    const lib = document.getElementById('receiptInputLibrary');
    if (lib){
      lib.addEventListener('change', (e)=>{
        const f = e.target.files?.[0];
        if (f) onScan(f);
        e.target.value='';
      });
    }

    $('btnSaveExpense').onclick = onSaveExpense;
    $('btnSaveBudget').onclick = onSaveBudget;
    $('btnSaveKey').onclick = onSaveKey;
    $('btnTestKey').onclick = onTestKey;

    $('btnExportExcel').onclick = async ()=>{
  const fn = window.ExpensAI?.excel?.exportExcelTemplate;
  if (typeof fn !== "function") {
    alert("Export Excel non disponibile: excel.js non caricato.");
    return;
  }
  try { await fn(); }
  catch(e){ alert('❌ Export Excel: ' + (e?.message||e)); }
};

    // set default date
    $('fDate').value = new Date().toISOString().slice(0,10);
  }

  window.addEventListener('DOMContentLoaded', bindUI);
})();
