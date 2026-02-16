(function(){
  const { db, firebase } = window.ExpensAI.firebase;
  const state = window.ExpensAI.state;

  function userRef(){
    if (!state.user?.uid) throw new Error('Not logged');
    return db.collection('users').doc(state.user.uid);
  }

  async function bindUser(){
    // budget input
    document.getElementById('budget').value = state.budget;
    document.getElementById('groqKey').value = state.groqKey;

    // unsubscribe previous
    if (state.unsubExpenses) { try{ state.unsubExpenses(); }catch{} }

    state.unsubExpenses = userRef().collection('expenses')
      .orderBy('seq','desc')
      .onSnapshot((snap)=>{
        state.expenses = snap.docs.map(d=>({ id:d.id, ...d.data() }));
        window.ExpensAI.ui?.renderExpenses();
        window.ExpensAI.ui?.renderAlerts();
      }, (err)=>{
        console.warn('listener err', err);
      });
  }

  async function refreshNow(){
    // One-shot refresh from server (useful on iOS when UI looks stale)
    const u = userRef();
    const snap = await u.get();
    const data = snap.data() || {};
    if (typeof data.budget === 'number') state.budget = data.budget;
    try{ document.getElementById('budget').value = state.budget; }catch{}

    const exSnap = await u.collection('expenses').orderBy('seq','desc').get();
    state.expenses = exSnap.docs.map(d=>({ id:d.id, ...d.data() }));
    window.ExpensAI.ui?.renderExpenses();
    window.ExpensAI.ui?.renderAlerts();
  }

  async function saveBudget(newBudget){
    state.budget = Number(newBudget)||1500;
    await userRef().update({ budget: state.budget });
  }

  async function addExpense(payload){
    // payload: {date, amount, desc, client, cat, receiptSaved:false, receiptFileName}
    const u = userRef();
    const expCol = u.collection('expenses');

    const res = await db.runTransaction(async (tx)=>{
      const snap = await tx.get(u);
      const nextSeq = (snap.data()?.nextSeq) || 1;
      tx.update(u, { nextSeq: nextSeq + 1 });
      const docId = String(nextSeq).padStart(6,'0');
      tx.set(expCol.doc(docId), {
        seq: nextSeq,
        date: payload.date,
        amount: payload.amount,
        desc: payload.desc,
        client: payload.client,
        cat: payload.cat,
        receiptSaved: false,
        receiptFileName: payload.receiptFileName || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { seq: nextSeq, id: docId };
    });

    return res;
  }

  async function markReceiptSaved(expenseId, receiptFileName){
    await userRef().collection('expenses').doc(expenseId).update({
      receiptSaved: true,
      receiptFileName: receiptFileName || null,
      receiptSavedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function updateExpense(expenseId, patch){
    await userRef().collection('expenses').doc(expenseId).update(patch);
  }

  window.ExpensAI.firestore = { bindUser, refreshNow, saveBudget, addExpense, markReceiptSaved, updateExpense };
})();
