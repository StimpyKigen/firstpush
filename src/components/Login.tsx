import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import GradientWaves from './GradientWaves';
import Hero from './Hero';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import './Login.css';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);

  // Lock body from scrolling or bouncing while on the auth interface
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, []);

  return (
    <div className="login-page-container">
      {/* Mobile top exit button */}
      <div className="mobile-top-bar">
        <Link to="/" className="mobile-close-btn" aria-label="Return to home">
          <X size={18} />
        </Link>
      </div>

      {/* Page Background Layer */}
      <div className="login-page-bg">
        <GradientWaves
          horizonColor="#cfd5dd"
          waveColor="#afb6c2"
          crestColor="#e0e4e9"
          amplitude={2.8}
          fogDepth={34}
          brightness={1.1}
          opacity={1}
          mouseInteraction={false}
          grain={false}
        />
      </div>

      {/* Main Animated Card */}
      <div className={`card ${isRegister ? 'register' : ''}`}>
        {/* Mobile segmented mode switch */}
        <div className="mobile-card-toggle">
          <button
            type="button"
            className={`toggle-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(false)}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`toggle-tab ${isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(true)}
          >
            Sign Up
          </button>
        </div>

        {/* Sliding Card Background (Desktop 0.65s slide) */}
        <div className="card-bg">
          <GradientWaves
            horizonColor="#032b38"
            waveColor="#14a3c4"
            crestColor="#7fdcef"
            amplitude={3.2}
            fogDepth={22}
            brightness={0.9}
          />
        </div>

        {/* Registration-side hero */}
        <Hero
          variant="register"
          title="Welcome back"
          text="To stay connected with fellow punters and track live slips, please login with your account."
          buttonLabel="Login"
          onSwitch={() => setIsRegister(false)}
        />

        {/* Login-side hero */}
        <Hero
          variant="login"
          title="Hello there"
          text="Register today to unlock high-accuracy jackpot consensus, free matches, and punter slips."
          buttonLabel="Sign Up"
          onSwitch={() => setIsRegister(true)}
        />

        {/* Forms */}
        <LoginForm onSwitchToRegister={() => setIsRegister(true)} />
        <RegisterForm onSwitchToLogin={() => setIsRegister(false)} />
      </div>
    </div>
  );
};

export default Login;
