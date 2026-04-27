import { Auth } from 'firebase/auth';
import { signInWithCustomToken, updateProfile } from 'firebase/auth';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const REGISTER_OPTIONS_URL = 'https://webauthnregisteroptions-yplzebhciq-ew.a.run.app';
const REGISTER_VERIFY_URL  = 'https://webauthnregisterverify-yplzebhciq-ew.a.run.app';
const BIOMETRIC_OPTIONS_URL = 'https://webauthnbiometricregisteroptions-yplzebhciq-ew.a.run.app';
const AUTH_OPTIONS_URL     = 'https://webauthnauthoptions-yplzebhciq-ew.a.run.app';
const AUTH_VERIFY_URL      = 'https://webauthnauthverify-yplzebhciq-ew.a.run.app';

const FETCH_TIMEOUT_MS = 30000;

/**
 * Maps raw WebAuthn/browser errors to our translation key names.
 * The calling component uses these keys with t() to show translated messages.
 */
export function getAuthErrorKey(error: any): string {
  const msg = (error?.message || '').toLowerCase();
  const name = (error?.name || '').toLowerCase();

  if (name === 'aborterror' || msg.includes('timed out') || msg.includes('abort')) {
    return 'auth_error_timeout';
  }
  if (name === 'notallowederror' || msg.includes('not allowed') || msg.includes('operation either timed out or was not allowed')) {
    return 'auth_error_not_allowed';
  }
  if (name === 'invalidstateerror' || msg.includes('invalid state')) {
    return 'auth_error_invalid_state';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return 'auth_error_network';
  }
  if (msg.includes('not found') || msg.includes('no user') || msg.includes('userid')) {
    return 'auth_error_user_not_found';
  }
  if (msg.includes('could not be verified') || msg.includes('registration could not')) {
    return 'auth_error_registration_verify';
  }
  if (msg.includes('biometric') && msg.includes('verified')) {
    return 'auth_error_biometric_verify';
  }
  if (msg.includes('biometric_registration_failed') || msg.includes('biometric registration failed')) {
    return 'auth_error_biometric_failed';
  }
  if (name === 'notallowederror' && msg.includes('face')) {
    return 'auth_error_face_not_supported_title';
  }
  if (msg.includes('authentication failed') || msg.includes('could not authenticate')) {
    return 'auth_error_auth_failed';
  }
  // Default fallback
  return 'auth_error_auth_failed';
}

/** Fetch with timeout and one automatic retry on failure */
async function fetchWithTimeout(url: string, options: RequestInit, retries = 1): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (err.name === 'AbortError') {
        const e = new Error('auth_error_timeout');
        e.name = 'AbortError';
        throw e;
      }
      const e = new Error('auth_error_network');
      e.name = 'NetworkError';
      throw e;
    }
  }
  throw new Error('auth_error_network');
}

export async function registerPasskey(auth: Auth, userId: string, displayName: string): Promise<{ success: boolean; errorKey?: string; error?: string }> {
  try {
    const optionsRes = await fetchWithTimeout(REGISTER_OPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName }),
    });
    const options = await optionsRes.json();
    if (options.error) return { success: false, errorKey: 'auth_error_registration_verify', error: options.error };

    const registrationResponse = await startRegistration({ optionsJSON: options });

    const verifyRes = await fetchWithTimeout(REGISTER_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...registrationResponse, userId, displayName }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.verified) return { success: false, errorKey: 'auth_error_registration_verify', error: 'Registration could not be verified.' };
    return { success: true };
  } catch (error: any) {
    console.error('Passkey registration error:', error);
    return { success: false, errorKey: getAuthErrorKey(error), error: error.message };
  }
}

export async function registerBiometric(auth: Auth, userId: string, displayName: string): Promise<{ success: boolean; errorKey?: string; error?: string }> {
  try {
    const optionsRes = await fetchWithTimeout(BIOMETRIC_OPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName }),
    });
    const options = await optionsRes.json();
    if (options.error) return { success: false, errorKey: 'auth_error_biometric_verify', error: options.error };

    const registrationResponse = await startRegistration({ optionsJSON: options });

    const verifyRes = await fetchWithTimeout(REGISTER_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...registrationResponse, userId, displayName }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.verified) return { success: false, errorKey: 'auth_error_biometric_verify', error: 'Biometric registration could not be verified.' };
    return { success: true };
  } catch (error: any) {
    console.error('Biometric registration error:', error);
    // Detect face recognition rejection specifically
    const msg = (error?.message || '').toLowerCase();
    const name = (error?.name || '').toLowerCase();
    if (name === 'notallowederror' || msg.includes('not allowed') || msg.includes('operation either timed out or was not allowed')) {
      return { success: false, errorKey: 'auth_error_face_not_supported_title', error: error.message };
    }
    return { success: false, errorKey: getAuthErrorKey(error), error: error.message };
  }
}

export async function authenticatePasskey(auth: Auth, userId: string): Promise<{ success: boolean; errorKey?: string; error?: string }> {
  try {
    const optionsRes = await fetchWithTimeout(AUTH_OPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const options = await optionsRes.json();
    if (options.error) return { success: false, errorKey: 'auth_error_user_not_found', error: options.error };

    const authResponse = await startAuthentication({ optionsJSON: options });

    const verifyRes = await fetchWithTimeout(AUTH_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...authResponse, userId }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.verified) return { success: false, errorKey: 'auth_error_auth_failed', error: 'Authentication failed. Please try again.' };

    const userCredential = await signInWithCustomToken(auth, verifyData.token);
    if (userCredential.user && verifyData.displayName) {
      await updateProfile(userCredential.user, { displayName: verifyData.displayName });
    }
    return { success: true };
  } catch (error: any) {
    console.error('Passkey auth error:', error);
    return { success: false, errorKey: getAuthErrorKey(error), error: error.message };
  }
}
