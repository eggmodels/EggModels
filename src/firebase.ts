import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DB_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MSG_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Analytics requires a valid measurementId/apiKey and throws synchronously if the
// REACT_APP_FIREBASE_* env vars are missing (e.g. a build run without .env.local).
// That throw happens at module-import time, before React ever renders, so it must
// not propagate or the whole site is a blank screen with no error boundary to catch it.
let analyticsInstance: Analytics | undefined;
try {
  analyticsInstance = getAnalytics(app);
} catch (err) {
  console.error('Firebase Analytics failed to initialize; continuing without it.', err);
}
export const analytics: Analytics | undefined = analyticsInstance;
// Firestore's default transport (fetch streams) hangs indefinitely — neither
// resolving nor rejecting — behind some corporate firewalls/antivirus SSL
// inspection and certain VPNs/proxies, since they break HTTP/2 streaming
// without closing the connection. experimentalAutoDetectLongPolling probes
// for that and falls back to XHR-based long-polling automatically, so this
// isn't a blanket performance tradeoff for everyone else.
export const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
