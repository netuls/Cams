import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTmLtAfc1qNNqTi-LAaTeVm5Eb-GywrwY",
  authDomain: "projeto-hor.firebaseapp.com",
  projectId: "projeto-hor",
  storageBucket: "projeto-hor.firebasestorage.app",
  messagingSenderId: "1021955246820",
  appId: "1:1021955246820:web:555b3a363c72c7d8b9baf1",
  measurementId: "G-NW2EH0HHZH"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const USER_ID = "camila_evelyn";

window._firebaseDB = db;
window._firebaseDocRef = (path) => doc(db, "usuarios", USER_ID, ...path.split("/"));
window._firebaseSetDoc = setDoc;
window._firebaseGetDoc = getDoc;
window._firebaseOnSnapshot = onSnapshot;
window._firebaseReady = true;

window.dispatchEvent(new Event("firebase-ready"));
