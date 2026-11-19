const ADMIN_TOKEN_KEY = 'ssp_admin_session_token';

export interface AdminSessionInfo {
  email: string;
  role: 'admin';
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
