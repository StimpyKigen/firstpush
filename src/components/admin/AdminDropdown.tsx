import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AdminDropdownOption<T extends string | number = string> {
  value: T;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ReactNode;
}

interface AdminDropdownProps<T extends string | number = string> {
  value: T;
  onChange: (val: T) => void;
  options: AdminDropdownOption<T>[];
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
}

export default function AdminDropdown<T extends string | number = string>({
  value,
  onChange,
  options,
  icon,
  placeholder,
  className,
  buttonClassName,
  menuClassName,
  align = 'left',
}: AdminDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full h-10 px-3.5 flex items-center justify-between gap-2 text-xs font-semibold rounded-xl border border-[#DCDCC8] dark:border-line bg-white dark:bg-panel text-slate-800 dark:text-cream hover:bg-slate-50 dark:hover:bg-panel-2 shadow-2xs transition-colors cursor-pointer select-none',
          buttonClassName
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {icon}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder || value}</span>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            'text-slate-400 dark:text-cream-dim shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-[#006C54] dark:text-emerald-400'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute top-full mt-2 min-w-full w-max max-w-[340px] bg-[#FFFFF0] dark:bg-[#202522] border border-[#DCDCC8] dark:border-[#414A43] rounded-2xl shadow-2xl py-1.5 z-50 max-h-[320px] overflow-y-auto text-xs no-scrollbar overscroll-contain p-1',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer select-none',
                  isSelected
                    ? 'text-[#006C54] dark:text-emerald-400 font-bold hover:bg-black/[0.04] dark:hover:bg-white/[0.08]'
                    : 'text-slate-800 dark:text-[#F4F5EF] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] font-medium'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {opt.count !== undefined && (
                    <span
                      className={cn(
                        'tabular-nums text-[11px] font-bold',
                        isSelected ? 'text-[#006C54] dark:text-emerald-400' : 'text-slate-500 dark:text-[#B5BDB6]'
                      )}
                    >
                      {opt.count}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={14} className="text-[#006C54] dark:text-emerald-400 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

