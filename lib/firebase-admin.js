import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Next.js evalúa este módulo (import estático) durante "Collecting page data"
// en el build, no solo cuando alguien realmente pega a una ruta. Si las
// credenciales de Admin SDK todavía no están en .env.local, cert() lanza
// una excepción y se cae el build entero. Por eso initializeApp() solo se
// intenta si las tres variables están presentes; si faltan, adminDb/adminStorage
// quedan en null y el error real (credenciales faltantes) solo aparece si
// una ruta que las usa es invocada, capturado por su propio try/catch.
const hasCredentials = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

if (hasCredentials && !getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminDb = hasCredentials ? getFirestore() : null;
export const adminStorage = hasCredentials ? getStorage() : null;
