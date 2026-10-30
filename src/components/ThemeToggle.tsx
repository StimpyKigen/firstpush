import React from 'react';
import { ThemeToggleSwitch } from './ui/switch';

export function ThemeToggle({ className }: { className?: string }) {
  return <ThemeToggleSwitch className={className} />;
}

export default ThemeToggle;

