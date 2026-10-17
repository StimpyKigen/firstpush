import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Lock, User, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff, Gift } from 'lucide-react';
import { useAuth, isValidPhone, isValidUsername, isValidPin } from '../lib/authStore';
import { useWallet } from '../lib/store';
import { AVATAR_CATALOG } from '../lib/avatarCatalog';
import { saveUserProfileToFirestore } from '../lib/firebasePhoneAuth';
import { validateUsername } from '../lib/contentModeration';

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const signUp = useAuth((s) => s.signUp);
  const isPhoneRegistered = useAuth((s) => s.isPhoneRegistered);
  const isUsernameTaken = useAuth((s) => s.isUsernameTaken);

  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [referredBy, setReferredBy] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || localStorage.getItem('mshindi_ref_code');
    if (ref) {
      setReferredBy(ref);
      localStorage.setItem('mshindi_ref_code', ref);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isValidPhone(phone)) {
      setError('Enter a valid phone number (e.g. 0743 304 579).');
      return;
    }

    if (isPhoneRegistered(phone)) {
      setError('This phone is already registered. Please login.');
      return;
    }

    const cleanUsername = username.trim();
    if (!isValidUsername(cleanUsername)) {
      setError('Username must be 3-16 letters & numbers.');
      return;
    }

    const modResult = validateUsername(cleanUsername);
    if (!modResult.isAllowed) {
      setError(modResult.reason || 'Username contains restricted words.');
      return;
    }

    if (isUsernameTaken(cleanUsername)) {
      setError('That username is already taken. Try another.');
      return;
    }

    if (!isValidPin(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setIsLoading(true);
    const defaultAvatar = AVATAR_CATALOG[0].id;
    const res = signUp(phone, pin, cleanUsername, defaultAvatar);
    setIsLoading(false);

    if (!res.ok) {
      setError(res.error || 'Registration failed.');
      return;
    }

    saveUserProfileToFirestore(phone, cleanUsername, defaultAvatar);

    // Credit referral tokens if invited
    if (referredBy) {
      useWallet.getState().creditReferralTokens(referredBy, cleanUsername);
      localStorage.removeItem('mshindi_ref_code');
    }

    setSuccess('Account created! Welcome to MshindiRoom.');
    setTimeout(() => {
      navigate('/');
    }, 900);
  };

  return (
    <div className="form register">
      <form onSubmit={handleSubmit} className="form-content">
        <h1 className="form-title">Create Account</h1>



        {referredBy && (
          <div className="referral-banner">
            <Gift size={13} />
            <span>Invited by @{referredBy} (+Tokens)</span>
          </div>
        )}

        {error && (
          <div className="form-alert error" role="alert">
            <AlertCircle size={14} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="form-alert success" role="alert">
            <CheckCircle2 size={14} className="alert-icon" />
            <span>{success}</span>
          </div>
        )}

        <div className="input-group">
          <div className="input-icon-wrapper">
            <Smartphone size={16} />
          </div>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Phone (07XX XXX XXX)"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            className="form-input"
            autoComplete="tel"
            required
          />
        </div>

        <div className="input-group">
          <div className="input-icon-wrapper">
            <User size={16} />
          </div>
          <input
            type="text"
            placeholder="Username (e.g. Winner254)"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.replace(/[^A-Za-z0-9]/g, ''));
              setError('');
            }}
            maxLength={16}
            className="form-input"
            autoComplete="username"
            required
          />
        </div>

        <div className="input-row-dual">
          <div className="input-group">
            <div className="input-icon-wrapper">
              <Lock size={15} />
            </div>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="4-digit PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              className="form-input"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="input-group">
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              className="form-input"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="password-toggle"
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
            >
              {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="form-aux-links">
          <span className="terms-micro">
            By signing up you agree to MshindiRoom terms.
          </span>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-link mobile-only-switch"
          >
            Already registered?
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading || pin.length !== 4 || confirmPin.length !== 4 || !username || !phone}
          className="submit-btn"
        >
          {isLoading ? (
            'Creating Account...'
          ) : (
            <>
              Sign Up <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
