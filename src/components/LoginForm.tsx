import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Lock, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth, isValidPhone, normalizePhone } from '../lib/authStore';
import { saveUserProfileToFirestore } from '../lib/firebasePhoneAuth';

interface LoginFormProps {
  onSwitchToRegister?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  const logIn = useAuth((s) => s.logIn);
  const isPhoneRegistered = useAuth((s) => s.isPhoneRegistered);
  const accounts = useAuth((s) => s.accounts);

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }

    if (!isValidPhone(phone)) {
      setError('Enter a valid phone number (e.g. 0743 304 579).');
      return;
    }

    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }

    setIsLoading(true);
    const res = logIn(phone, pin);
    setIsLoading(false);

    if (!res.ok) {
      // If no account exists yet, let them know or offer switch
      if (!isPhoneRegistered(phone)) {
        setError('No account found for this number. Switch to Sign Up.');
      } else {
        setError(res.error || 'Incorrect PIN. Please try again.');
      }
      return;
    }

    setSuccess('Signed in successfully! Redirecting...');
    saveUserProfileToFirestore(phone, 'Punter');
    setTimeout(() => {
      navigate('/');
    }, 800);
  };

  const handleDemoFill = () => {
    // Fill demo account if available, or create quick demo credentials
    if (accounts.length > 0) {
      setPhone(accounts[0].phone);
      setPin(accounts[0].pin);
    } else {
      setPhone('0743304579');
      setPin('1234');
    }
    setError('');
  };

  return (
    <div className="form login">
      <form onSubmit={handleSubmit} className="form-content">
        <h1 className="form-title">Sign In</h1>

        <button
          type="button"
          onClick={() => {
            setError('Google sign-in initialized. Please use phone & PIN to access all MshindiRoom features.');
          }}
          className="google-btn"
          aria-label="Sign in with Google"
        >
          <img src="/google.svg" alt="Google" width="18" height="18" className="google-icon" />
          <span>Sign in with Google</span>
        </button>

        <div className="form-divider">
          <span>or use your phone</span>
        </div>

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
            <Lock size={16} />
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
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="password-toggle"
            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
          >
            {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <div className="form-aux-links">
          <button
            type="button"
            onClick={handleDemoFill}
            className="text-link demo-link"
          >
            Demo Fill
          </button>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-link mobile-only-switch"
          >
            Create account
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading || pin.length !== 4 || !phone}
          className="submit-btn"
        >
          {isLoading ? (
            'Signing in...'
          ) : (
            <>
              Sign In <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
