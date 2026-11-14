import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { formatE164KenyanPhone } from './phoneUtils.js';
import { reportError } from './errors/errorReporter';

const SMS_SEND_FALLBACK = "We couldn't send the SMS code right now. Please try again shortly.";
const SMS_VERIFY_FALLBACK = "We couldn't verify that code. Please check it and try again.";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    recaptchaWidgetId?: number;
    grecaptcha?: any;
    confirmationResult?: ConfirmationResult;
  }
}

export function resetRecaptcha(): void {
  try {
    if (typeof window.grecaptcha !== 'undefined') {
      if (typeof window.recaptchaWidgetId !== 'undefined') {
        window.grecaptcha.reset(window.recaptchaWidgetId);
      } else if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(function(widgetId: number) {
          window.recaptchaWidgetId = widgetId;
          if (window.grecaptcha) {
            window.grecaptcha.reset(widgetId);
          }
        }).catch((err: any) => {
          console.warn('reCAPTCHA render reset error:', err);
        });
      }
    }
  } catch (err) {
    console.warn('resetRecaptcha error:', err);
  }
}

export function formatE164Phone(phone: string): string {
  return formatE164KenyanPhone(phone);
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function setupRecaptcha(containerId: string = 'recaptcha-container'): RecaptchaVerifier | null {
  if (!auth) return null;
  try {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      document.body.appendChild(el);
    }
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        // ignore clear error if not rendered
      }
      recaptchaVerifier = null;
    }
    if (el) {
      el.innerHTML = '';
    }

    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('[Firebase Phone Auth Debug] reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.warn('[Firebase Phone Auth Debug] reCAPTCHA expired');
        resetRecaptcha();
      },
    });
    window.recaptchaVerifier = recaptchaVerifier;
    return recaptchaVerifier;
  } catch (err) {
    console.warn('[Firebase Phone Auth Debug] Recaptcha setup notice:', err);
    return null;
  }
}

export async function sendFirebasePhoneOtp(
  phone: string,
  containerId: string = 'recaptcha-container'
): Promise<{ ok: boolean; confirmationResult?: ConfirmationResult; formattedPhone: string; error?: string }> {
  const formattedPhone = formatE164Phone(phone);
  if (!auth) {
    reportError(new Error('Firebase Auth is not initialized.'), { source: 'phoneAuth.send' });
    return { ok: false, formattedPhone, error: SMS_SEND_FALLBACK };
  }

  try {
    const verifier = setupRecaptcha(containerId) || window.recaptchaVerifier;
    if (!verifier) {
      reportError(new Error('reCAPTCHA verifier unavailable.'), { source: 'phoneAuth.send' });
      return { ok: false, formattedPhone, error: SMS_SEND_FALLBACK };
    }
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    window.confirmationResult = confirmationResult;

    return { ok: true, confirmationResult, formattedPhone };
  } catch (err: any) {
    // Developer diagnostics (redacted: phone numbers and tokens are scrubbed).
    reportError(err, {
      source: 'phoneAuth.send',
      domain: 'auth',
      extra: { projectId: auth?.app?.options?.projectId, authDomain: auth?.app?.options?.authDomain },
    });

    resetRecaptcha();
    const errCode = String(err?.code || '');
    const errStr = errCode + ' ' + String(err?.message || '') + ' ' + String(err || '');

    // User-facing copy only: no project ids, hostnames, console paths or provider codes.
    let msg = SMS_SEND_FALLBACK;
    if (errCode === 'auth/invalid-phone-number' || errStr.includes('auth/invalid-phone-number')) {
      msg = "That phone number doesn't look right. Please check it and try again.";
    } else if (errCode === 'auth/quota-exceeded' || errStr.includes('quota-exceeded')) {
      msg = "We've sent a lot of codes today. Please try again later.";
    } else if (errCode === 'auth/too-many-requests' || errStr.includes('too-many-requests')) {
      msg = 'Too many code requests. Please wait a moment before trying again.';
    } else if (errCode === 'auth/network-request-failed') {
      msg = "You're having connection trouble. Check your network and try again.";
    }

    return { ok: false, formattedPhone, error: msg };
  }
}

export async function verifyFirebaseOtpCode(
  confirmationResult: ConfirmationResult | null,
  otpCode: string
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!confirmationResult) {
    return { ok: false, error: 'Your verification session has expired. Please request a new code.' };
  }

  try {
    const userCredential = await confirmationResult.confirm(otpCode);
    return { ok: true, userId: userCredential.user.uid };
  } catch (err: any) {
    reportError(err, { source: 'phoneAuth.verify', domain: 'auth' });
    let msg = SMS_VERIFY_FALLBACK;
    if (err?.code === 'auth/invalid-verification-code') {
      msg = 'Incorrect 6-digit SMS code. Please re-enter.';
    } else if (err?.code === 'auth/code-expired') {
      msg = 'The SMS verification code has expired. Please request a new code.';
    } else if (err?.code === 'auth/network-request-failed') {
      msg = "You're having connection trouble. Check your network and try again.";
    }
    return { ok: false, error: msg };
  }
}

export async function getCurrentFirebaseIdToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function saveUserProfileToFirestore(phone: string, username: string, avatarId?: string) {
  if (!db) return;
  // Require an authenticated Firebase user before writing user profile metadata;
  // SMS verification status (`verifiedWithSms`) is strictly server-verified via ID token.
  const currentFbUser = auth?.currentUser;
  if (!currentFbUser) return;

  try {
    const normPhone = phone.replace(/\D/g, '');
    const e164Phone = formatE164Phone(normPhone);
    const uid = currentFbUser.uid;

    const payload = {
      phone: normPhone,
      e164Phone,
      username,
      avatarId: avatarId || 'default',
      uid,
      updatedAt: new Date().toISOString(),
    };

    // Save non-privileged profile metadata under UID
    await setDoc(doc(db, 'users', uid), payload, { merge: true });
  } catch (e) {
    console.warn('Firestore user profile sync warning:', e);
  }
}

export async function getUserProfileFromFirestore(phoneOrUid: string) {
  if (!db) return null;
  try {
    const docRef = doc(db, 'users', phoneOrUid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (e) {
    console.warn('Firestore fetch user profile warning:', e);
  }
  return null;
}
