import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    serverTimestamp, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYeZoFQH63Wwgx-xctjuXYjNesLT26dIM",
  authDomain: "registropatio.firebaseapp.com",
  databaseURL: "https://registropatio-default-rtdb.firebaseio.com",
  projectId: "registropatio",
  storageBucket: "registropatio.firebasestorage.app",
  messagingSenderId: "73122095979",
  appId: "1:73122095979:web:9f69533a3bcdcc4ff1622e",
  measurementId: "G-0LVVLX5ZRY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { 
    db, 
    auth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection, 
    serverTimestamp, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc, 
    query, 
    orderBy 
};


