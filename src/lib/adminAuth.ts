import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { adminClientAuth, isAdminFirestoreUser } from './firebase';

const ADMIN_TOKEN_KEY = 'ssp_admin_session_token';

export interface AdminSessionInfo {
  email: string;
  role: 'admin';
}

/**
 * After password panel login, sign into isolated Firebase Auth so Firestore
 * rules recognize the admin — no Google popup.
 */
export async function connectAdminFirestoreAuth(
  email: string,
  password: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    await signInWithEmailAndPassword(adminClientAuth, normalized, password);
  } catch (signInErr: unknown) {
    const code =
      signInErr && typeof signInErr === 'object' && 'code' in signInErr
        ? String((signInErr as { code: string }).code)
        : '';

    if (
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-login-credentials'
    ) {
      try {
        await createUserWithEmailAndPassword(
          adminClientAuth,
          normalized,
          password
        );
      } catch (createErr: unknown) {
        const createCode =
          createErr && typeof createErr === 'object' && 'code' in createErr
            ? String((createErr as { code: string }).code)
            : '';
        if (createCode === 'auth/email-already-in-use') {
          throw new Error(
            'Admin Firebase account exists but the password does not match. Use the same password as Firebase Auth for this admin email.'
          );
        }
        throw createErr instanceof Error
          ? createErr
          : new Error('Could not create admin Firestore session.');
      }
    } else {
      throw signInErr instanceof Error
        ? signInErr
        : new Error('Could not connect admin Firestore session.');
    }
  }

  if (!isAdminFirestoreUser(adminClientAuth.currentUser)) {
    await signOut(adminClientAuth);
    throw new Error(
      'Signed in, but this email is not allowed for Admin Firestore. Update firestore.rules password admin emails to match ADMIN_EMAIL.'
    );
  }
}

export async function disconnectAdminFirestoreAuth(): Promise<void> {
  try {
    await signOut(adminClientAuth);
  } catch {
    // ignore
  }
}

export function getStoredAdminToken(): string | null {
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

export async function loginAdminWithCredentials(
  email: string,
  password: string
): Promise<AdminSessionInfo> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.token || !data?.admin) {
    throw new Error(data?.error || 'Invalid admin email or password.');
  }

  setStoredAdminToken(data.token);
  try {
    await connectAdminFirestoreAuth(email, password);
  } catch (firestoreAuthErr) {
    setStoredAdminToken(null);
    throw firestoreAuthErr;
  }
  return data.admin as AdminSessionInfo;
}

export async function verifyStoredAdminSession(): Promise<AdminSessionInfo | null> {
  const token = getStoredAdminToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/admin/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setStoredAdminToken(null);
      return null;
    }
    const data = await response.json().catch(() => null);
    if (!data?.authenticated || !data?.admin) {
      setStoredAdminToken(null);
      return null;
    }
    return data.admin as AdminSessionInfo;
  } catch {
    return null;
  }
}

export async function logoutAdminSession(): Promise<void> {
  const token = getStoredAdminToken();
  setStoredAdminToken(null);
  await disconnectAdminFirestoreAuth();
  if (!token) return;
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore network error on logout
  }
}

