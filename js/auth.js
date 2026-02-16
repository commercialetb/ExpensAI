(function(){
  const { auth, db, firebase } = window.ExpensAI.firebase;
  const state = window.ExpensAI.state;

  function normalizeNameForEmail(name){
    return (name||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'.')
      .replace(/^\.|\.$/g,'') || 'user';
  }
  
  function makePassword(pin){
    // Firebase Email/Password requires at least 6 characters.
    // We keep UX as 4-digit PIN but derive a deterministic 8-char password.
    return `EA${String(pin||'').padStart(4,'0')}00`;
  }
  function makeAuthEmail(name, employeeId){
    const n = normalizeNameForEmail(name);
    const m = (employeeId||'').replace(/\s+/g,'');
    return `${n}.${m}@expensai.local`;
  }

  async function ensureUserDoc(uid, profile){
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        name: profile.name,
        employeeId: profile.employeeId,
        budget: 1500,
        nextSeq: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  async function register(name, employeeId, pin){
    const email = makeAuthEmail(name, employeeId);
    const password = makePassword(pin);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    await ensureUserDoc(uid, {name, employeeId});
  }

  async function login(name, employeeId, pin){
    const email = makeAuthEmail(name, employeeId);
    const password = makePassword(pin);
    await auth.signInWithEmailAndPassword(email, password);
  }

  async function logout(){
    await auth.signOut();
  }

  auth.onAuthStateChanged(async (user)=>{
    const cloudStatus = document.getElementById('cloudStatus');
    if (!user){
      state.user = null;
      cloudStatus.textContent = 'Cloud: —';
      window.ExpensAI.ui?.showLoggedOut();
      return;
    }

    try {
      cloudStatus.textContent = 'Cloud: ⏳ connessione…';
      const doc = await db.collection('users').doc(user.uid).get();
      const data = doc.exists ? doc.data() : {};
      state.user = { uid: user.uid, name: data.name || user.displayName || 'Utente', employeeId: data.employeeId || '' };
      state.budget = data.budget || 1500;

      // Load local per-user Groq key
      const k = localStorage.getItem(`groq_${user.uid}`) || '';
      state.groqKey = k;

      cloudStatus.textContent = 'Cloud: ✅ online';
      window.ExpensAI.ui?.showLoggedIn();
      window.ExpensAI.firestore?.bindUser();
    } catch(e){
      console.warn(e);
      cloudStatus.textContent = 'Cloud: ❌ errore';
      window.ExpensAI.ui?.showLoggedIn();
    }
  });

  window.ExpensAI.auth = { register, login, logout };
})();
