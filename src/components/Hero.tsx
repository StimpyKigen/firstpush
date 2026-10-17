import React from 'react';

export interface HeroProps {
  variant: 'login' | 'register' | string;
  title: string;
  text: string;
  buttonLabel: string;
  onSwitch: () => void;
}

export const Hero: React.FC<HeroProps> = ({ variant, title, text, buttonLabel, onSwitch }) => (
  <div className={`hero ${variant}`}>
    <h2>{title}</h2>
    <p>{text}</p>
    <button
      type="button"
      className="switch"
      onClick={onSwitch}
    >
      {buttonLabel}
    </button>
  </div>
);

export default Hero;
