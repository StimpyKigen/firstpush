import React, { useState, useEffect } from 'react';
import Hero from './Hero';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import GridMotion from './GridMotion';
import { getShuffledClubLogos } from '../constants/clubLogos';
import './Login.css';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [shuffledLogos, setShuffledLogos] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setShuffledLogos(getShuffledClubLogos());

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 720);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Strictly prevent vertical scrolling on the login page across all viewports
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  return (
    <div className="login-page-container">
      {/* Animated Motion Background with Shuffled Club Logos */}
      <div className="login-grid-motion-bg" aria-hidden="true">
        {shuffledLogos.length > 0 && (
          <GridMotion
            items={shuffledLogos}
            rows={isMobile ? 5 : 5}
            aspectRatio={1.0}
            gap={isMobile ? 10 : 14}
            radius={14}
            angle={-10}
            tilt={0}
            speed={20}
            direction="alternate"
            parallax={0}
            spotlight={0.65}
            dim={0.45}
            fade={0.35}
            grayscale={false}
          />
        )}
      </div>

      {/* Main Animated Card */}
      <div className={`card login-card ${isRegister ? 'register' : ''}`}>
        {/* Full Card Mobile Football Pitch Background */}
        <div className="mobile-card-pitch-bg" aria-hidden="true">
          <img
            src="/images/auth-pitch-bg.jpg"
            alt="Football Pitch Background"
            className="mobile-card-pitch-img"
          />
          <div className="mobile-card-pitch-overlay" />
        </div>

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
          <div className="card-bg-pitch-wrapper">
            <img
              src="/images/auth-pitch-bg.jpg"
              alt="Pitch background texture"
              className="card-bg-pitch-image"
            />
            <div className="card-bg-pitch-overlay" />
          </div>
        </div>

        {/* Registration-side hero (Desktop) */}
        <Hero
          variant="register"
          title="Welcome back"
          text="To stay connected with fellow punters and track live slips, please login with your account."
          buttonLabel="Login"
          onSwitch={() => setIsRegister(false)}
        />

        {/* Login-side hero (Desktop) */}
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
