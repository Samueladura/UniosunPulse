import {API_BASE_URL, APPS_SCRIPT_EMAIL_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_BASE_URL = 'https://UniOsunInfobackend.onrender.com/api';
const ACCESS_TOKEN_KEY = 'UniOsunInfo.access_token';
const configuredBaseUrl = (API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  '',
);
const baseUrl = /\/api$/i.test(configuredBaseUrl)
  ? configuredBaseUrl
  : `${configuredBaseUrl}/api`;
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

function toUrl(path: string) {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(toUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
      ...(init.headers || {}),
    },
  });

  if (response.status === 401) {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    if (accessToken) {
      sessionExpiredHandler?.();
    }
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(
          retryAfter
            ? `Too many requests. Please try again in ${retryAfter} seconds.`
            : 'Too many requests. Please wait a few minutes and try again.',
        );
      }
      if (response.status === 404) {
        throw new Error(
          'The API endpoint was not found (404). Check that API_BASE_URL points to the backend and includes /api.',
        );
      }
      throw new Error(`The API returned invalid JSON (${response.status}).`);
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  const newToken = payload?.data?.session?.access_token;
  if (
    newToken &&
    [
      '/auth/sign-in',
      '/auth/verify-otp',
      '/auth/mfa/complete-sign-in',
    ].includes(path)
  ) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, newToken);
  } else if (path === '/auth/sign-out') {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  return (payload as T) ?? ({} as T);
}

export async function apiGet<T>(path: string, params?: Record<string, any>) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  });

  const query = search.toString();
  return apiFetch<T>(`${path}${query ? `?${query}` : ''}`);
}

export type SessionResponse = {
  data: {
    session: {
      access_token?: string;
      user?: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, any>;
      };
    } | null;
  };
  error?: {message?: string} | null;
};

export async function getCurrentSession(): Promise<SessionResponse> {
  const response = await apiFetch<SessionResponse>('/auth/session', {
    method: 'GET',
  });
  if (!response?.data?.session) {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  return response;
}

export async function getCurrentUser(): Promise<{
  data: {user: any | null};
  error?: {message?: string} | null;
}> {
  return apiFetch('/auth/user', {method: 'GET'});
}

export async function updateAuthUser(payload: {
  data?: Record<string, any>;
  password?: string;
}) {
  return apiFetch('/auth/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function signInWithPassword(email: string, password: string) {
  return apiFetch('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({email, password}),
  });
}

export async function requestPasswordReset(email: string) {
  return apiFetch('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({email}),
  });
}

export async function completePasswordReset(
  email: string,
  code: string,
  password: string,
) {
  return apiFetch('/auth/password-reset/complete', {
    method: 'POST',
    body: JSON.stringify({email, code, password}),
  });
}

export async function completeMfaSignIn(challengeId: string, code: string) {
  return apiFetch('/auth/mfa/complete-sign-in', {
    method: 'POST',
    body: JSON.stringify({challengeId, code}),
  });
}

export async function enrollMfaFactor() {
  return apiFetch('/auth/mfa/enroll', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getMfaFactors() {
  return apiFetch('/auth/mfa/factors', {method: 'GET'});
}

export async function createMfaChallenge(factorId: string) {
  return apiFetch('/auth/mfa/challenge', {
    method: 'POST',
    body: JSON.stringify({factorId}),
  });
}

export async function verifyMfaFactor(
  factorId: string,
  challengeId: string,
  code: string,
) {
  return apiFetch('/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({factorId, challengeId, code}),
  });
}

export async function removeMfaFactor(factorId: string) {
  return apiFetch('/auth/mfa/unenroll', {
    method: 'POST',
    body: JSON.stringify({factorId}),
  });
}

export async function signUpWithPassword(
  email: string,
  password: string,
  options?: {data?: Record<string, any>},
) {
  return apiFetch('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({email, password, options}),
  });
}

export async function signInWithOtp(
  email: string,
  options?: {shouldCreateUser?: boolean},
) {
  return apiFetch('/auth/sign-in-otp', {
    method: 'POST',
    body: JSON.stringify({
      email,
      options: options ?? {shouldCreateUser: false},
    }),
  });
}

export async function verifyOtp({
  email,
  token,
  type,
}: {
  email: string;
  token: string;
  type: string;
}) {
  return apiFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({email, token, type}),
  });
}

export async function signOutUser() {
  try {
    return await apiFetch('/auth/sign-out', {method: 'POST'});
  } finally {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export async function rpcCall<T>(name: string, args: Record<string, any> = {}) {
  return apiFetch<T>(`/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export async function dbQuery<T>(table: string, payload: Record<string, any>) {
  return apiFetch<T>(`/db/${table}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Google Apps Script Email Integration
// Deploy your Apps Script as a Web App and set APPS_SCRIPT_EMAIL_URL in .env
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export async function sendEmailViaAppsScript(params: SendEmailParams) {
  const appsScriptUrl = APPS_SCRIPT_EMAIL_URL;
  if (!appsScriptUrl) {
    console.warn('APPS_SCRIPT_EMAIL_URL not configured, skipping email');
    return {success: false, error: 'Email service not configured'};
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Apps Script returned ${response.status}`);
    }

    const result = await response.json();
    return {success: true, data: result};
  } catch (error) {
    console.error('Failed to send email via Apps Script:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
