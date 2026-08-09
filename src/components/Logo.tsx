import React, { useState } from 'react';
import appLogo from '../assets/images/app_logo_1785495412555.jpg';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 34, className = '' }: LogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`shrink-0 rounded-full bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center font-bold text-ink text-xs ${className}`}
      >
        MR
      </div>
    );
  }

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative shrink-0 rounded-full overflow-hidden ring-1 ring-gold/50 shadow-[0_0_12px_rgba(242,183,5,0.3)] bg-ink flex items-center justify-center ${className}`}
    >
      <img
        src={appLogo}
        alt="Mshindi Room Logo"
        onError={() => setHasError(true)}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover rounded-full"
      />
    </div>
  );
}
