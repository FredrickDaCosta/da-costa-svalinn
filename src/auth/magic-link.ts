'use client';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, updateProfile } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

const ACTION_CODE_SETTINGS = {
  url: 'https://dacosta-svalinn.com/finish-login',
  handleCodeInApp: true,
};
const EMAIL_KEY = 'dacosta-magic-email';
const USERID_KEY = 'dacosta-magic-userid';
const DISPLAYNAME_KEY = 'dacosta-magic-displayname';

export async function sendMagicLink(auth: Auth, email: string, userId: string, displayName: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(USERID_KEY, userId);
    localStorage.setItem(DISPLAYNAME_KEY, displayName);
    return { success: true };
  } catch (error: any) {
    console.error('Magic link error:', error);
    return { success: false, error: error.message };
  }
}

export async function completeMagicLinkSignIn(auth: Auth): Promise<{ success: boolean; userId?: string; displayName?: string; error?: string }> {
  try {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      return { success: false, error: 'Not a valid sign-in link.' };
    }
    const email = localStorage.getItem(EMAIL_KEY);
    const userId = localStorage.getItem(USERID_KEY) || '';
    const displayName = localStorage.getItem(DISPLAYNAME_KEY) || userId;
    if (!email) return { success: false, error: 'Email not found. Please request a new link.' };
    const result = await signInWithEmailLink(auth, email, window.location.href);
    if (result.user && displayName) await updateProfile(result.user, { displayName });
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(USERID_KEY);
    localStorage.removeItem(DISPLAYNAME_KEY);
    return { success: true, userId, displayName };
  } catch (error: any) {
    console.error('Magic link completion error:', error);
    return { success: false, error: error.message };
  }
}
