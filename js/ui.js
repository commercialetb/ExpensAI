(function(){
  const state = window.ExpensAI.state;

  function $(id){ return document.getElementById(id); }

  function show(el, yes){
    if (!el) return;
    el.classList.toggle('hidden', !yes);
  }

  function showLoggedOut(){
    show($('loginScreen'), true);
    show($('registerScreen'), false);
    show($('appScreen'), false);
  }

  function showLoggedIn(){
    show($('loginScreen'), false);
    show($('registerScreen'), false);
    show($('appScreen'), true);

    $('userLabel').textContent = state.user?.name || '—';
    $('userSub').textContent = state.user?.employeeId ? `Matricola: ${state.user.employeeId}` : '';

    $('budget').value = state.budget;
    $('groqKey').value = state.groqKey || '';
  }

  function money(n){
    const v = Number(n||0);
    return v.toLocaleString('it-IT', { style:'currency', currency:'EUR' });
  }

  function renderExpenses(){
    const box = $('expensesList');
    box.innerHTML = '';

    const filtered = state.expenses.filter(e=> (e.date||'').startsWith(state.selectedMonth||''));
    if (!filtered.length){
      box.innerHTML = '<div class="text-sm opacity-70">Nessuna spesa ancora.</div>';
      return;
    }

    filtered.forEach((e)=>{
      const wrap = document.createElement('div');
      wrap.className = 'glass rounded-xl p-3';

      const top = document.createElement('div');
      top.className = 'flex items-start justify-between gap-3';
      top.innerHTML = `
        <div>
          <div class="font-bold">#${String(e.seq).padStart(3,'0')} · ${e.date} · ${money(e.amount)}</div>
          <div class="text-sm opacity-80">${escapeHtml(e.desc||'')} — <span class="opacity-70">${escapeHtml(e.client||'')}</span></div>
          <div class="text-xs opacity-60">Categoria: ${escapeHtml(e.cat||'')}</div>
        </div>
        <div class="text-xs">${e.receiptSaved ? '✅ Ricevuta salvata' : '⏳ Ricevuta non salvata'}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'mt-2 flex gap-2';

      const btnPdf = document.createElement('button');
      btnPdf.className = 'px-3 py-2 rounded-xl bg-white/10 text-sm';
      btnPdf.textContent = e.receiptSaved ? 'Salva di nuovo PDF' : 'Salva ricevuta (PDF)';
      btnPdf.onclick = async ()=>{
        try {
          const res = await window.ExpensAI.pdf.saveReceiptPdf(e);
          // Mark as saved
          await window.ExpensAI.firestore.markReceiptSaved(e.id, res.fileName);
        } catch(err){
          alert('❌ ' + (err?.message || err));
        }
      };

      actions.appendChild(btnPdf);
      wrap.appendChild(top);
      wrap.appendChild(actions);
      box.appendChild(wrap);
    });
  }

  function renderAlerts(){
    const box = $('alerts');
    box.innerHTML = '';

    const monthKey = (d)=> d.slice(0,7);
    const cur = state.selectedMonth || (()=>{ const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; })();

    const curExpenses = state.expenses.filter(e=> (e.date||'').startsWith(cur));
    const total = curExpenses.reduce((s,e)=> s + Number(e.amount||0), 0);
    const budget = Number(state.budget||0);

    const a = [];
    if (budget>0){
      const pct = total/budget;
      if (pct >= 1) a.push({t:'⚠️ Budget superato', d:`Hai speso ${money(total)} su ${money(budget)}.`});
      else if (pct >= 0.85) a.push({t:'⚠️ Vicino al limite', d:`Hai speso ${Math.round(pct*100)}% del budget.`});
      else a.push({t:'✅ Budget ok', d:`${money(total)} su ${money(budget)}.`});
    }

    const unsaved = curExpenses.filter(e=> !e.receiptSaved).length;
    if (unsaved) a.push({t:'⏳ Ricevute non salvate', d:`${unsaved} spese di questo mese senza PDF salvato.`});

    // duplicates hint: same amount+date occurrences
    const seen = new Map();
    let dups = 0;
    for (const e of curExpenses){
      const k = `${e.date}|${Number(e.amount||0).toFixed(2)}`;
      seen.set(k, (seen.get(k)||0)+1);
    }
    for (const [k,v] of seen) if (v>1) dups += (v-1);
    if (dups) a.push({t:'🔁 Possibili duplicati', d:`Trovati ${dups} possibili duplicati (stessa data/importo).`});

    if (!a.length) a.push({t:'—', d:'Nessun alert.'});

    for (const it of a){
      const div = document.createElement('div');
      div.className = 'p-3 rounded-xl bg-white/5 border border-white/10';
      div.innerHTML = `<div class="font-semibold">${escapeHtml(it.t)}</div><div class="text-xs opacity-80 mt-1">${escapeHtml(it.d)}</div>`;
      box.appendChild(div);
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  window.ExpensAI.ui = { showLoggedOut, showLoggedIn, renderExpenses, renderAlerts };
})();
