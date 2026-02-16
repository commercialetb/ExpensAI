(function(){
  const firebaseConfig = {
    apiKey: "AIzaSyCU5vNOjFIpzVTnKC6qLTF8-v64axx-YVg",
    authDomain: "expensai-67eeb.firebaseapp.com",
    projectId: "expensai-67eeb",
    storageBucket: "expensai-67eeb.firebasestorage.app",
    messagingSenderId: "540622633385",
    appId: "1:540622633385:web:20c324ee33153c78ba2cb8",
    measurementId: "G-EV890V9YWP"
  };

  if (!window.ExpensAI) window.ExpensAI = {};

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  window.ExpensAI.firebase = { auth, db, firebase };
})();
