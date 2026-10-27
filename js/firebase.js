import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';

// Firebase web config is public app metadata, not a secret. Restrict this key
// in Google Cloud and secure data with Firebase Security Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyD95KdLBtELyvvCabe4svymBGi5Ezupybg",
  authDomain: "bankguaranteeapp.firebaseapp.com",
  projectId: "bankguaranteeapp",
  storageBucket: "bankguaranteeapp.firebasestorage.app",
  messagingSenderId: "836104418127",
  appId: "1:836104418127:web:a676433a2b5acf98558b3a",
  measurementId: "G-B0CBRZDEZZ"
};

export const firebaseConfigured = Object.values(firebaseConfig).every((value) =>
  value && !value.includes('YOUR_')
);

export const firebaseApp = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
