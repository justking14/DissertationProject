import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
     apiKey: "AIzaSyDea_AWSBJRfRkf4Sj4ewKYNVri4Nd_QqQ",
     authDomain: "disstest2-ca1bb.firebaseapp.com",
     projectId: "disstest2-ca1bb",
     storageBucket: "disstest2-ca1bb.firebasestorage.app",
     messagingSenderId: "835248210191",
     appId: "1:835248210191:web:db099ae78ee65c4822fe7a",
     measurementId: "G-N3L13Z5DCG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };
