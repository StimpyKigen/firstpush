import { Link } from 'react-router-dom';
import { Smartphone, KeyRound, User, AlertCircle, CheckCircle2, ArrowRight, LogIn as LogInIcon, UserPlus, ImageIcon, ShieldCheck, Loader2, RefreshCw, Gift } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import PinInput from '../components/PinInput';
import OtpInput from '../components/OtpInput';
import AvatarPicker from '../components/AvatarPicker';
import Logo from '../components/Logo';
import { formatE164Phone } from '../lib/firebasePhoneAuth';
import { isValidUsername } from '../lib/authStore';
import { useAuthFlow } from '../lib/useAuthFlow';

export default function Auth() {
  const {
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
  } = useAuthFlow();

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
                onChange={(e) => setPhone(e.target.value)}
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

            <OtpInput value={otpCode} onChange={setOtpCode} />

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
              <PinInput value={pin} onChange={setPin} />
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
              <PinInput value={pin} onChange={setPin} />
            </div>
            <div>
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center justify-center gap-1.5 mb-3">
                Confirm PIN
              </p>
              <PinInput value={confirmPin} onChange={setConfirmPin} />
            </div>

            <div>
              <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <User size={13} /> Choose a Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
