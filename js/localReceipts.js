(function(){
  const state = window.ExpensAI.state;

  function key(){
    if (!state.user?.uid) return null;
    return `receipts_${state.user.uid}`;
  }

  function load(){
    const k = key();
    if (!k) return {};
    try{ return JSON.parse(localStorage.getItem(k) || '{}') || {}; }catch{ return {}; }
  }

  function save(map){
    const k = key();
    if (!k) return;
    try{ localStorage.setItem(k, JSON.stringify(map)); }catch{}
  }

  async function attachToExpense(expenseId){
    if (!expenseId) return;
    if (!state.lastReceiptDataUrl) return; // nothing to attach
    const map = load();
    map[expenseId] = {
      dataUrl: state.lastReceiptDataUrl,
      meta: state.lastReceiptMeta || null,
      ts: Date.now()
    };
    save(map);
  }

  function getForExpense(expenseId){
    const map = load();
    return map[expenseId] || null;
  }

  async function pickImage(opts = {}){
    return new Promise((resolve,reject)=>{
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // On iOS this encourages opening the camera directly (still may show options depending on device/settings)
      if (opts.preferCamera) input.capture = 'environment';
      input.onchange = async ()=>{
        try{
          const f = input.files?.[0];
          if (!f) return reject(new Error('Nessuna foto selezionata'));
          // reuse ai.compressImage indirectly: use a tiny local compressor here
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
                resolve({dataUrl, meta:{w,h}});
              } catch(e){ reject(e); }
            };
            img.onerror = reject;
            img.src = ev.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        } catch(e){ reject(e); }
      };
      input.click();
    });
  }

  window.ExpensAI.localReceipts = { attachToExpense, getForExpense, pickImage };
})();
