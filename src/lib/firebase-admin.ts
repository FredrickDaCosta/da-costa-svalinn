import { getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App;

function getAdminApp(): App {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp({
      credential: applicationDefault(),
      projectId: 'da-costa-unisoc23v1-6386-61f95',
    });
  }
  return app;
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
