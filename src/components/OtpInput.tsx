import React, { useRef } from 'react';

export default function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  function setDigit(i: number, d: string) {
    const clean = d.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = clean;
    const next = arr.join('').slice(0, 6).replace(/\s/g, '');
    onChange(next);
    if (clean && i < 5) refs[i + 1].current?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs[i - 1].current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste) {
      onChange(paste);
      const targetIndex = Math.min(paste.length, 5);
      refs[targetIndex].current?.focus();
    }
  }

  return (
    <div className="flex gap-1.5 xs:gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={handlePaste}
          inputMode="numeric"
          maxLength={1}
          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold bg-ink border-2 border-line rounded-xl text-cream focus:outline-none focus:border-gold transition-colors"
        />
      ))}
    </div>
  );
}
