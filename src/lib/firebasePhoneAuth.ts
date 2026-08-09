import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

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
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254')) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `+254${cleaned.slice(1)}`;
  if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) return `+254${cleaned}`;
  return `+${cleaned}`;
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
    return { ok: false, formattedPhone, error: 'Firebase Auth is not initialized.' };
  }

  // Debug Logging before call
  console.log('[Firebase Phone Auth Attempt Debug]', {
    projectId: auth.app.options.projectId,
    authDomain: auth.app.options.authDomain,
    currentUser: auth.currentUser ? { uid: auth.currentUser.uid, phoneNumber: auth.currentUser.phoneNumber } : null,
    targetPhone: formattedPhone,
    windowOrigin: window.location.origin,
  });

  try {
    const verifier = setupRecaptcha(containerId) || window.recaptchaVerifier;
    if (!verifier) {
      return { ok: false, formattedPhone, error: 'Failed to initialize reCAPTCHA verifier.' };
    }
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    window.confirmationResult = confirmationResult;

    console.log('[Firebase Phone Auth Success Debug]', {
      projectId: auth.app.options.projectId,
      formattedPhone,
      sessionCreated: !!confirmationResult,
    });

    return { ok: true, confirmationResult, formattedPhone };
  } catch (err: any) {
    // Task 9 Debug Logging
    console.error('[Firebase Phone Auth Error Debug]', {
      projectId: auth?.app?.options?.projectId,
      authDomain: auth?.app?.options?.authDomain,
      currentUser: auth?.currentUser ? { uid: auth.currentUser.uid } : null,
      errorCode: err?.code,
      errorMessage: err?.message,
      fullErrorObject: err,
    });

    resetRecaptcha();
    let msg = err?.message || 'Failed to send SMS code via Firebase.';
    const errCode = String(err?.code || '');
    const errStr = errCode + ' ' + String(err?.message || '') + ' ' + String(err || '');

    if (errCode === 'auth/invalid-phone-number' || errStr.includes('auth/invalid-phone-number')) {
      msg = `Invalid phone number format (${formattedPhone}). Please check the number and try again. [${errCode}]`;
    } else if (errCode === 'auth/operation-not-allowed' || errStr.includes('operation-not-allowed')) {
      msg = `Phone Sign-In is not enabled in your Firebase Console for project "${auth?.app?.options?.projectId}". Please enable Phone Auth in Firebase Console -> Authentication -> Sign-in method. [${errCode}]`;
    } else if (errCode === 'auth/quota-exceeded' || errStr.includes('quota-exceeded')) {
      msg = `SMS quota exceeded for today. Please try again later or add test phone numbers in Firebase Console. [${errCode}]`;
    } else if (errCode === 'auth/too-many-requests' || errStr.includes('too-many-requests')) {
      msg = `Too many SMS requests sent. Please wait a moment before trying again. [${errCode}]`;
    } else if (errCode === 'auth/unauthorized-domain' || errStr.includes('unauthorized-domain')) {
      msg = `This domain (${window.location.hostname}) is not added to Firebase Authorized Domains. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add ${window.location.hostname}. [${errCode}]`;
    } else {
      msg = `${err?.message || 'Failed to send SMS.'} (${errCode || 'Unknown Error'})`;
    }

    return { ok: false, formattedPhone, error: msg };
  }
}

export async function verifyFirebaseOtpCode(
  confirmationResult: ConfirmationResult | null,
  otpCode: string
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  if (!confirmationResult) {
    return { ok: false, error: 'No active Firebase SMS verification session found.' };
  }

  try {
    const userCredential = await confirmationResult.confirm(otpCode);
    return { ok: true, userId: userCredential.user.uid };
  } catch (err: any) {
    console.error('Firebase Code Verification Error:', err);
    let msg = 'Invalid SMS code. Please check your SMS inbox and try again.';
    if (err?.code === 'auth/invalid-verification-code') {
      msg = 'Incorrect 6-digit SMS code. Please re-enter.';
    } else if (err?.code === 'auth/code-expired') {
      msg = 'The SMS verification code has expired. Please request a new code.';
    }
    return { ok: false, error: msg };
  }
}

export async function saveUserProfileToFirestore(phone: string, username: string, avatarId?: string) {
  if (!db) return;
  try {
    const normPhone = phone.replace(/\D/g, '');
    const e164Phone = formatE164Phone(normPhone);
    const uid = auth?.currentUser?.uid || null;

    const payload = {
      phone: normPhone,
      e164Phone,
      username,
      avatarId: avatarId || 'default',
      uid,
      verifiedWithSms: true,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save profile under normalized phone number
    await setDoc(doc(db, 'users', normPhone), payload, { merge: true });

    // Also save under UID if signed in via Firebase Auth
    if (uid) {
      await setDoc(doc(db, 'users', uid), payload, { merge: true });
    }
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
