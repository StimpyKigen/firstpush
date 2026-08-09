import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Smartphone, KeyRound, User, AlertCircle, CheckCircle2, ArrowRight, LogIn as LogInIcon, UserPlus, ImageIcon, ShieldCheck, Loader2, RefreshCw, Gift } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { useAuth, isValidPhone, isValidUsername } from '../lib/authStore';
import { useWallet } from '../lib/store';
import PinInput from '../components/PinInput';
import OtpInput from '../components/OtpInput';
import AvatarPicker from '../components/AvatarPicker';
import Logo from '../components/Logo';
import { AVATAR_CATALOG } from '../lib/avatarCatalog';
import { sendFirebasePhoneOtp, verifyFirebaseOtpCode, saveUserProfileToFirestore, formatE164Phone } from '../lib/firebasePhoneAuth';
import { validateUsername } from '../lib/contentModeration';
import type { ConfirmationResult } from 'firebase/auth';

type Mode = 'signup' | 'login';

export default function Auth() {
  const navigate = useNavigate();
  const signUp = useAuth((s) => s.signUp);
  const logIn = useAuth((s) => s.logIn);
  const isUsernameTaken = useAuth((s) => s.isUsernameTaken);
  const isPhoneRegistered = useAuth((s) => s.isPhoneRegistered);

  const [mode, setMode] = useState<Mode>('signup');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState(AVATAR_CATALOG[0].id);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<1 | 'otp' | 2 | 3>(1);
  const [referredBy, setReferredBy] = useState<string | null>(null);

  // Firebase Phone Auth states
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
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

  function resetAll() {
    setPhone('');
    setPin('');
    setConfirmPin('');
    setUsername('');
    setAvatarId(AVATAR_CATALOG[0].id);
    setError('');
    setSuccess('');
    setStep(1);
    setOtpCode('');
    setConfirmationResult(null);
    setPhoneVerified(false);
    setFormattedE164('');
  }

  function switchMode(m: Mode) {
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

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
      <SeoHead
        title={mode === 'signup' ? 'Create Account' : 'Sign In'}
        description="MshindiRoom Authentication: Sign up or log in securely to access jackpot consensus, free matches, and punter leaderboards."
        noIndex={true}
      />
      <div id="recaptcha-container"></div>
      <div className="text-center mb-8">
        <Logo size={56} className="mx-auto mb-3" />
        <h1 className="font-display font-extrabold text-3xl text-cream">
          {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
        </h1>
        <p className="text-cream-dim text-sm mt-2">
          {mode === 'signup'
            ? 'Firebase Phone Verification with SMS OTP: secure & instant.'
            : 'Log in with your phone number and PIN.'}
        </p>

        {mode === 'signup' && referredBy && (
          <div className="mt-4 inline-flex items-center gap-2 bg-gold/15 border border-gold/40 text-gold px-3.5 py-1.5 rounded-full text-xs font-bold animate-rise">
            <Gift size={14} />
            <span>Invited by @{referredBy} • Earn bonus Mshindi Tokens!</span>
          </div>
        )}
      </div>

      <div className="flex bg-panel border border-line rounded-full p-1 mb-8 h-12 items-center">
        <button
          onClick={() => switchMode('signup')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-sm font-bold transition-all ${
            mode === 'signup' ? 'bg-gold text-ink' : 'text-cream-dim hover:text-cream'
          }`}
        >
          <UserPlus size={15} /> Sign Up
        </button>
        <button
          onClick={() => switchMode('login')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-sm font-bold transition-all ${
            mode === 'login' ? 'bg-gold text-ink' : 'text-cream-dim hover:text-cream'
          }`}
        >
          <LogInIcon size={15} /> Log In
        </button>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-7">
        {step === 1 && (
          <div className="flex flex-col gap-4 animate-rise">
            <div>
              <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Smartphone size={13} /> Phone Number
              </label>
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                placeholder="07XX XXX XXX or +254 7XX..."
                inputMode="tel"
                className={`w-full bg-ink border rounded-lg px-3 py-3 text-sm font-mono text-cream placeholder:text-cream-dim/50 focus:outline-none transition-colors ${
                  phoneValid === false ? 'border-danger' : phoneValid ? 'border-emerald-2' : 'border-line focus:border-gold'
                }`}
              />
              {phoneValid === false && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mt-1.5">
                  <AlertCircle size={12} /> Enter a valid phone number (7 to 15 digits)
                </p>
              )}
              {phoneTaken && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mt-1.5">
                  <AlertCircle size={12} /> Number already registered: try logging in
                </p>
              )}
              {mode === 'login' && phone.length > 0 && phoneValid && !isPhoneRegistered(phone) && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mt-1.5">
                  <AlertCircle size={12} /> No account for this number: sign up first
                </p>
              )}
              <p className="text-[11px] text-cream-dim mt-1.5">
                We'll send a 6-digit SMS verification code to your phone number via Firebase.
              </p>
            </div>

            {error && (
              <div className="flex flex-col gap-2.5 p-3.5 bg-danger/10 border border-danger/30 rounded-xl animate-rise">
                <p className="flex items-start gap-1.5 text-xs text-danger font-semibold">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
                </p>
                {(error.includes('Firebase Console') || error.includes('operation-not-allowed') || error.includes('Phone')) && (
                  <div className="text-[11px] text-cream-dim bg-ink/60 p-2.5 rounded-lg border border-line/50 space-y-1">
                    <p className="font-bold text-cream text-xs">To enable real SMS in Firebase Console:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Open <span className="text-gold font-mono">console.firebase.google.com</span></li>
                      <li>Select project <span className="text-gold font-mono">mshindiroom-production</span></li>
                      <li>Go to <span className="font-semibold text-cream">Authentication &rarr; Sign-in method</span></li>
                      <li>Click <span className="font-semibold text-cream">Phone</span> and toggle to <span className="text-emerald-2 font-semibold">Enabled</span></li>
                    </ol>
                  </div>
                )}
                <button
                  onClick={bypassOtpForTesting}
                  className="w-full py-2 bg-gold/20 hover:bg-gold/30 border border-gold/40 text-gold font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 mt-1"
                >
                  <ShieldCheck size={14} /> Bypass SMS & Continue to PIN Setup
                </button>
              </div>
            )}

            <button
              onClick={startPhoneVerification}
              disabled={!phone || sendingOtp}
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm h-12 rounded-xl transition-all mt-1"
            >
              {sendingOtp ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending SMS Code...
                </>
              ) : (
                <>
                  Send Verification Code <ArrowRight size={15} />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                onClick={bypassOtpForTesting}
                disabled={!phone}
                className="text-xs text-cream-dim hover:text-gold underline disabled:opacity-40"
              >
                Skip SMS & use PIN verification directly
              </button>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="flex flex-col gap-5 animate-rise">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase bg-emerald-2/15 text-emerald-2 px-3 py-1 rounded-full mb-3">
                <ShieldCheck size={14} /> Firebase Phone Auth
              </span>
              <h3 className="font-display font-bold text-lg text-cream">Enter 6-Digit SMS Code</h3>
              <p className="text-xs text-cream-dim mt-1">
                Code sent to <span className="font-mono text-gold font-bold">{formattedE164 || formatE164Phone(phone)}</span>
              </p>
            </div>

            <OtpInput value={otpCode} onChange={(v) => { setOtpCode(v); setError(''); }} />

            {error && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-danger font-semibold text-center">
                <AlertCircle size={13} className="shrink-0" /> {error}
              </p>
            )}
            {success && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-2 font-semibold text-center">
                <CheckCircle2 size={13} className="shrink-0" /> {success}
              </p>
            )}

            <button
              onClick={handleVerifyOtpCode}
              disabled={otpCode.length !== 6 || verifyingOtp}
              className="inline-flex items-center justify-center gap-2 bg-emerald-2 hover:bg-emerald disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm h-12 rounded-xl transition-all"
            >
              {verifyingOtp ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying Code...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Verify SMS Code
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-dashed border-line">
              <button
                onClick={startPhoneVerification}
                disabled={sendingOtp}
                className="text-gold hover:underline flex items-center gap-1 font-semibold"
              >
                <RefreshCw size={12} /> Resend SMS
              </button>
              <button
                onClick={() => setStep(1)}
                className="text-cream-dim hover:text-cream font-semibold"
              >
                Change Phone
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={bypassOtpForTesting}
                className="text-[11px] text-cream-dim/70 hover:text-gold underline"
              >
                (Demo / Testing mode: Skip to PIN setup)
              </button>
            </div>
          </div>
        )}

        {step === 2 && mode === 'login' && (
          <div className="flex flex-col gap-5 animate-rise">
            <div>
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center justify-center gap-1.5 mb-3">
                <KeyRound size={13} /> Enter your 4-digit PIN
              </p>
              <PinInput value={pin} onChange={(v) => { setPin(v); setError(''); }} />
            </div>

            {error && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-danger font-semibold">
                <AlertCircle size={13} /> {error}
              </p>
            )}
            {success && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-2 font-semibold">
                <CheckCircle2 size={13} /> {success}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 text-sm font-semibold text-cream-dim hover:text-cream border border-line rounded-lg py-3">
                Back
              </button>
              <button
                onClick={handleLogin}
                disabled={pin.length !== 4}
                className="flex-[2] flex items-center justify-center gap-2 bg-emerald-2 hover:bg-emerald disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm py-3 rounded-lg transition-colors"
              >
                <LogInIcon size={15} /> Log In
              </button>
            </div>
          </div>
        )}

        {step === 2 && mode === 'signup' && (
          <div className="flex flex-col gap-5 animate-rise">
            {phoneVerified && (
              <div className="flex items-center gap-2 p-3 bg-emerald-2/15 border border-emerald-2/40 rounded-xl text-emerald-2 text-xs font-bold">
                <ShieldCheck size={16} /> Phone Number Verified with Firebase Auth!
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center justify-center gap-1.5 mb-3">
                <KeyRound size={13} /> Choose a 4-digit PIN
              </p>
              <PinInput value={pin} onChange={(v) => { setPin(v); setError(''); }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center justify-center gap-1.5 mb-3">
                Confirm PIN
              </p>
              <PinInput value={confirmPin} onChange={(v) => { setConfirmPin(v); setError(''); }} />
            </div>

            <div>
              <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <User size={13} /> Choose a Username
              </label>
              <input
                value={username}
                onChange={(e) => { setUsername(e.target.value.replace(/[^A-Za-z0-9]/g, '')); setError(''); }}
                placeholder="e.g. BankerOnly254"
                maxLength={16}
                className={`w-full bg-ink border rounded-lg px-3 py-3 text-sm font-mono text-cream placeholder:text-cream-dim/50 focus:outline-none transition-colors ${
                  usernameValid === false || usernameTaken ? 'border-danger' : usernameValid && !usernameTaken ? 'border-emerald-2' : 'border-line focus:border-gold'
                }`}
              />
              <p className="text-[11px] text-cream-dim mt-1.5">Letters and numbers only, 3-16 characters. No two punters can share a username.</p>
              {usernameValid === false && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mt-1.5">
                  <AlertCircle size={12} /> Letters/numbers only, 3-16 characters
                </p>
              )}
              {usernameTaken && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mt-1.5">
                  <AlertCircle size={12} /> Username already taken
                </p>
              )}
              {usernameValid && !usernameTaken && username.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold mt-1.5">
                  <CheckCircle2 size={12} /> Username available
                </p>
              )}
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-danger font-semibold">
                <AlertCircle size={13} /> {error}
              </p>
            )}
            {success && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold">
                <CheckCircle2 size={13} /> {success}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 text-sm font-semibold text-cream-dim hover:text-cream border border-line rounded-lg py-3">
                Back
              </button>
              <button
                onClick={goToAvatarStep}
                disabled={pin.length !== 4 || confirmPin.length !== 4 || !isValidUsername(username) || usernameTaken}
                className="flex-[2] flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm py-3 rounded-lg transition-colors"
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && mode === 'signup' && (
          <div className="flex flex-col gap-5 animate-rise">
            <div>
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center justify-center gap-1.5 mb-1">
                <ImageIcon size={13} /> Choose Your Avatar
              </p>
              <p className="text-xs text-cream-dim text-center mb-4">Pick a football-themed profile picture. You can change it anytime later.</p>
              <AvatarPicker selected={avatarId} onSelect={setAvatarId} />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-danger font-semibold">
                <AlertCircle size={13} /> {error}
              </p>
            )}
            {success && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold">
                <CheckCircle2 size={13} /> {success}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 text-sm font-semibold text-cream-dim hover:text-cream border border-line rounded-lg py-3">
                Back
              </button>
              <button
                onClick={handleSignup}
                className="flex-[2] flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm py-3 rounded-lg transition-colors"
              >
                <UserPlus size={15} /> Create Account
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-cream-dim mt-6 flex flex-wrap justify-center items-center gap-1">
        <span>By continuing you agree to our</span>
        <Link to="/terms" className="text-gold hover:underline font-medium">Terms of Service</Link>
        <span>&amp;</span>
        <Link to="/privacy" className="text-gold hover:underline font-medium">Privacy Policy</Link>
        <span>•</span>
        <Link to="/how-it-works" className="text-emerald-2 hover:underline">How it works</Link>
      </p>
    </div>
  );
}
