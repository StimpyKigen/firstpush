import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isValidPhone, isValidUsername } from './authStore';
import { useWallet } from './store';
import { AVATAR_CATALOG } from './avatarCatalog';
import { sendFirebasePhoneOtp, verifyFirebaseOtpCode, saveUserProfileToFirestore } from './firebasePhoneAuth';
import { validateUsername } from './contentModeration';
import type { ConfirmationResult } from 'firebase/auth';

export type AuthMode = 'signup' | 'login';
export type AuthStep = 1 | 'otp' | 2 | 3;

/** Drives the sign-up / log-in step machine (Firebase phone OTP -> PIN -> username -> avatar). */
export function useAuthFlow() {
  const navigate = useNavigate();
  const signUp = useAuth((s) => s.signUp);
  const logIn = useAuth((s) => s.logIn);
  const isUsernameTaken = useAuth((s) => s.isUsernameTaken);
  const isPhoneRegistered = useAuth((s) => s.isPhoneRegistered);

  const [mode, setMode] = useState<AuthMode>('signup');
  const [phone, setPhoneRaw] = useState('');
  const [pin, setPinRaw] = useState('');
  const [confirmPin, setConfirmPinRaw] = useState('');
  const [username, setUsernameRaw] = useState('');
  const [avatarId, setAvatarId] = useState(AVATAR_CATALOG[0].id);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<AuthStep>(1);
  const [referredBy, setReferredBy] = useState<string | null>(null);

  // Firebase Phone Auth states
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCode, setOtpCodeRaw] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [formattedE164, setFormattedE164] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('mshindi_ref_code', ref);
      setReferredBy(ref);
    } else {
      const stored = localStorage.getItem('mshindi_ref_code');
      if (stored) setReferredBy(stored);
    }
  }, []);

  const phoneValid = phone.length === 0 ? null : isValidPhone(phone);
  const usernameValid = username.length === 0 ? null : isValidUsername(username);
  const usernameTaken = Boolean(username.length > 0 && usernameValid && isUsernameTaken(username));
  const phoneTaken = Boolean(mode === 'signup' && phone.length > 0 && phoneValid && isPhoneRegistered(phone));

  function setPhone(v: string) {
    setPhoneRaw(v);
    setError('');
  }

  function setPin(v: string) {
    setPinRaw(v);
    setError('');
  }

  function setConfirmPin(v: string) {
    setConfirmPinRaw(v);
    setError('');
  }

  function setUsername(v: string) {
    setUsernameRaw(v.replace(/[^A-Za-z0-9]/g, ''));
    setError('');
  }

  function setOtpCode(v: string) {
    setOtpCodeRaw(v);
    setError('');
  }

  function resetAll() {
    setPhoneRaw('');
    setPinRaw('');
    setConfirmPinRaw('');
    setUsernameRaw('');
    setAvatarId(AVATAR_CATALOG[0].id);
    setError('');
    setSuccess('');
    setStep(1);
    setOtpCodeRaw('');
    setConfirmationResult(null);
    setPhoneVerified(false);
    setFormattedE164('');
  }

  function switchMode(m: AuthMode) {
    setMode(m);
    resetAll();
  }

  async function startPhoneVerification() {
    setError('');
    if (!isValidPhone(phone)) {
      setError('Enter a valid phone number (e.g. 0743 304 579 or +254 743 304 579).');
      return;
    }
    if (mode === 'signup' && isPhoneRegistered(phone)) {
      setError('This phone number already has an account. Switch to Log In.');
      return;
    }
    if (mode === 'login' && !isPhoneRegistered(phone)) {
      setError('No account found for that number. Switch to Sign Up.');
      return;
    }

    setSendingOtp(true);
    const res = await sendFirebasePhoneOtp(phone, 'recaptcha-container');
    setSendingOtp(false);

    if (res.ok && res.confirmationResult) {
      setConfirmationResult(res.confirmationResult);
      setFormattedE164(res.formattedPhone);
      setStep('otp');
      setSuccess(`Firebase SMS code sent to ${res.formattedPhone}`);
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(res.error || 'Failed to send SMS code. Please try again.');
    }
  }

  async function handleVerifyOtpCode() {
    setError('');
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit SMS verification code.');
      return;
    }

    setVerifyingOtp(true);
    const res = await verifyFirebaseOtpCode(confirmationResult, otpCode);
    setVerifyingOtp(false);

    if (res.ok) {
      setPhoneVerified(true);
      setSuccess('Phone number verified successfully with Firebase Auth!');
      setTimeout(() => {
        setSuccess('');
        setStep(2);
      }, 1000);
    } else {
      setError(res.error || 'Invalid verification code. Please check your SMS inbox.');
    }
  }

  function bypassOtpForTesting() {
    setPhoneVerified(true);
    setStep(2);
  }

  function handleLogin() {
    setError('');
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }
    const res = logIn(phone, pin);
    if (!res.ok) {
      setError(res.error ?? 'Login failed.');
      return;
    }
    setSuccess('Logged in! Redirecting…');
    saveUserProfileToFirestore(phone, username || 'Punter');
    setTimeout(() => navigate('/'), 900);
  }

  function goToAvatarStep() {
    setError('');
    if (pin.length !== 4) {
      setError('Choose a 4-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    if (!isValidUsername(username)) {
      setError('Username must be 3-16 characters, letters and numbers only.');
      return;
    }
    const modResult = validateUsername(username);
    if (!modResult.isAllowed) {
      setError(modResult.reason ?? 'Username contains forbidden profanity or offensive language.');
      return;
    }
    if (isUsernameTaken(username)) {
      setError('That username is already taken.');
      return;
    }
    setStep(3);
  }

  function handleSignup() {
    setError('');
    const res = signUp(phone, pin, username, avatarId);
    if (!res.ok) {
      setError(res.error ?? 'Sign up failed.');
      return;
    }
    saveUserProfileToFirestore(phone, username, avatarId);

    // Credit referral Mshindi Tokens to inviter
    const refCode = localStorage.getItem('mshindi_ref_code');
    if (refCode) {
      useWallet.getState().creditReferralTokens(refCode, username);
      localStorage.removeItem('mshindi_ref_code');
    }

    setSuccess('Account created! Welcome to MshindiRoom.');
    setTimeout(() => navigate('/'), 900);
  }

  return {
    mode,
    switchMode,
    phone,
    setPhone,
    pin,
    setPin,
    confirmPin,
    setConfirmPin,
    username,
    setUsername,
    avatarId,
    setAvatarId,
    error,
    success,
    step,
    setStep,
    referredBy,
    sendingOtp,
    verifyingOtp,
    otpCode,
    setOtpCode,
    phoneVerified,
    formattedE164,
    phoneValid,
    usernameValid,
    usernameTaken,
    phoneTaken,
    isPhoneRegistered,
    startPhoneVerification,
    handleVerifyOtpCode,
    bypassOtpForTesting,
    handleLogin,
    goToAvatarStep,
    handleSignup,
  };
}
