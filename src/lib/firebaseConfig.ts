// Firebase Configuration Module
// When building on Vercel / GitHub without firebase-applet-config.json,
// it uses Vite environment variables (VITE_FIREBASE_*).

const rawConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "eighth-fuze-l6d0h",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:697254017828:web:1e173f10058ad0f38351b1",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAjpAlScXxqAIfQt-M5moLfNFcJaJZXJDA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "eighth-fuze-l6d0h.firebaseapp.com",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-mybucket-8e5dde08-9b53-4f81-a3e3-2a1d3dd68642",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "eighth-fuze-l6d0h.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "697254017828",
};

export default rawConfig;
