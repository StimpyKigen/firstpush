import React, { useRef } from 'react';

export default function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const digits = value.padEnd(4, ' ').split('').slice(0, 4);

  function setDigit(i: number, d: string) {
    const clean = d.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = clean;
    const next = arr.join('').slice(0, 4).replace(/\s/g, '');
    onChange(next);
    if (clean && i < 3) refs[i + 1].current?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs[i - 1].current?.focus();
    }
  }

  return (
    <div className="flex gap-2 xs:gap-3 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-mono font-bold bg-ink border-2 border-line rounded-xl text-cream focus:outline-none focus:border-gold transition-colors"
        />
      ))}
    </div>
  );
}
