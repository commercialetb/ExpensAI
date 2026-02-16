(function(){
  const state = window.ExpensAI.state;

  function detectCategory(desc){
    const d=(desc||'').toLowerCase();
    if (/(hotel|albergo|b&b|bnb|city tax|tassa di soggiorno)/.test(d)) return 'pernottamento';
    if (/(carburante|benzina|diesel|autostrada|pedaggio|parcheggio|telepass)/.test(d)) return 'autoveicoli';
    if (/(treno|aereo|taxi|metro|bus|biglietto)/.test(d)) return 'trasporto';
    if (/(ristorante|cena|pranzo|bar|colazione|pasto|pizza)/.test(d)) return 'vitto_affari';
    return 'altro';
  }

  function compressImage(file){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = (ev)=>{
        const img = new Image();
        img.onload = ()=>{
          try{
            let w=img.width, h=img.height;
            const maxDim=1280;
            if (w>h && w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; }
            else if (h>=w && h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; }
            const c=document.createElement('canvas');
            c.width=w; c.height=h;
            const ctx=c.getContext('2d');
            ctx.drawImage(img,0,0,w,h);
            const dataUrl=c.toDataURL('image/jpeg',0.82);
            resolve({dataUrl, w, h});
          }catch(e){reject(e)}
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function groqRequest(key, payload, timeoutMs=45000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    try{
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const j = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(j?.error?.message || 'Errore API Groq');
      return j;
    } finally {
      clearTimeout(t);
    }
  }

  async function scanReceipt(file){
    const key = (state.groqKey || '').trim();
    if (!key) throw new Error('Inserisci Groq API Key');

    const {dataUrl, w, h} = await compressImage(file);
    state.lastReceiptDataUrl = dataUrl;
    state.lastReceiptMeta = {w,h};

    const payload = {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {type:'text', text:'Estrai JSON: {"date":"YYYY-MM-DD","amount":0.00,"desc":"","client":"","cat":"autoveicoli|pernottamento|trasporto|vitto_affari|altro"}. Se mancano dati, lascia stringa vuota o 0.'},
          {type:'image_url', image_url:{url:dataUrl}}
        ]
      }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const j = await groqRequest(key, payload, 45000);
    const content = j?.choices?.[0]?.message?.content || '{}';
    let data;
    try{ data = JSON.parse(content); }catch{ data = {}; }

    const cat = (data.cat && ['autoveicoli','pernottamento','trasporto','vitto_affari','altro'].includes(data.cat))
      ? data.cat
      : detectCategory(data.desc||'');

    return {
      date: data.date || new Date().toISOString().slice(0,10),
      amount: Number(data.amount||0),
      desc: data.desc || '',
      client: data.client || '',
      cat
    };
  }

  async function testGroqKey(){
    const key = (state.groqKey||'').trim();
    if (!key) throw new Error('Nessuna chiave');
    const payload = {
      model: 'llama-3.1-8b-instant',
      messages: [{role:'user', content:'ping'}],
      temperature: 0
    };
    await groqRequest(key, payload, 15000);
    return true;
  }

  function findDuplicate(candidate, expenses){
    // Simple: same amount (±0.01) and same day or ±1 day, and description similarity.
    const amt = Number(candidate.amount||0);
    const d0 = new Date(candidate.date);
    const norm = (s)=> (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const cDesc = norm(candidate.desc);
    for (const e of expenses){
      const a2 = Number(e.amount||0);
      if (Math.abs(a2-amt) > 0.01) continue;
      const d2 = new Date(e.date);
      const dd = Math.abs((d2 - d0) / (1000*60*60*24));
      if (dd > 1.1) continue;
      const eDesc = norm(e.desc);
      if (!cDesc || !eDesc) return e;
      if (cDesc === eDesc) return e;
      // token overlap
      const setA = new Set(cDesc.split(' ').filter(Boolean));
      const setB = new Set(eDesc.split(' ').filter(Boolean));
      let inter=0;
      for (const t of setA) if (setB.has(t)) inter++;
      const score = inter / Math.max(1, Math.min(setA.size, setB.size));
      if (score >= 0.6) return e;
    }
    return null;
  }

  window.ExpensAI.ai = { scanReceipt, detectCategory, testGroqKey, findDuplicate };
})();
