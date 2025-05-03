// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC_xBPzBxpaW9-79NyrBZMehox35lMdwxo",
    authDomain: "alto-voltaje-running-team.firebaseapp.com",
    projectId: "alto-voltaje-running-team",
    storageBucket: "alto-voltaje-running-team.firebasestorage.app",
    messagingSenderId: "157154969817",
    appId: "1:157154969817:web:3fc5f63a1d2310456156c8",
    measurementId: "G-9VYXX6X598"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Make variables globally available
window.db = db;
window.auth = auth;
window.analytics = analytics; 