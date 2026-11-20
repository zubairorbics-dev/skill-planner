import { initializeApp } from 'firebase/app';
import { Auth, getAuth, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass the provisioned firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAPPED_ADMIN_EMAIL = 'zubair.orbics@gmail.com';

/** Must match firestore.rules isPasswordPanelAdmin + .env ADMIN_EMAIL */
export const PASSWORD_PANEL_ADMIN_EMAILS = [
  'admin.skill@yopmail.com',
  'admin@smartskillplanner.com',
] as const;

// Isolated secondary Firebase client for Admin Console so Learner App sign-out
// or account switching never disconnects the Admin Console database session.
const adminClientApp = initializeApp(firebaseConfig, 'admin-console');
export const adminDb = getFirestore(adminClientApp, firebaseConfig.firestoreDatabaseId);
export const adminClientAuth = getAuth(adminClientApp);
export const adminGoogleAuthProvider = new GoogleAuthProvider();
adminGoogleAuthProvider.setCustomParameters({
  login_hint: BOOTSTRAPPED_ADMIN_EMAIL,
});
export const adminSelectAccountProvider = new GoogleAuthProvider();
adminSelectAccountProvider.setCustomParameters({
  login_hint: BOOTSTRAPPED_ADMIN_EMAIL,
  prompt: 'select_account',
});

export function isPasswordPanelAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return PASSWORD_PANEL_ADMIN_EMAILS.some((e) => e === normalized);
}

export function isVerifiedBootstrappedAdmin(user: User | null | undefined): boolean {
  return Boolean(
    user?.emailVerified &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );
}

/** True when Admin Console Firebase Auth can read admin-scoped Firestore data. */
export function isAdminFirestoreUser(user: User | null | undefined): boolean {
  if (!user?.email) return false;
  return (
    isVerifiedBootstrappedAdmin(user) || isPasswordPanelAdminEmail(user.email)
  );
}

export function getActiveAdminDb() {
  if (isAdminFirestoreUser(adminClientAuth.currentUser)) {
    return { targetDb: adminDb, targetAuth: adminClientAuth };
  }
  if (isAdminFirestoreUser(auth.currentUser)) {
    return { targetDb: db, targetAuth: auth };
  }
  return { targetDb: adminDb, targetAuth: adminClientAuth };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authInstance: Auth = auth
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authInstance.currentUser?.uid ?? null,
      email: authInstance.currentUser?.email ?? null,
      emailVerified: authInstance.currentUser?.emailVerified ?? null,
      isAnonymous: authInstance.currentUser?.isAnonymous ?? null,
      tenantId: authInstance.currentUser?.tenantId ?? null,
      providerInfo:
        authInstance.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connection on initial boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();
