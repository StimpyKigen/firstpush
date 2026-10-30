"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";
import { MoonIcon, SunMediumIcon } from "lucide-react";
import { useTheme } from "@/src/lib/themeStore";

// The customized Switch component with icon and thumb customization
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
    icon?: React.ReactNode;
    thumbClassName?: string;
  }
>(({ className, icon, thumbClassName, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#66CF11] data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-[#343C36]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none flex h-4 w-4 rounded-full bg-white dark:bg-[#F4F5EF] text-slate-800 dark:text-[#202522] shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 items-center justify-center",
        thumbClassName
      )}
    >
      {icon ? icon : null}
    </SwitchPrimitive.Thumb>
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

/**
 * Connected Theme Switcher component for MshindiRoom.
 * Supports the customized switch layout with Sun/Moon icons,
 * toggles dark/light theme, and synchronizes with localStorage and documentElement.
 * Sized 50% on mobile and 75% on desktop (25% reduction) for proportional aesthetics.
 */
export const ThemeToggleSwitch: React.FC<{ className?: string }> = ({ className }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={cn("inline-flex items-center justify-center shrink-0 w-8 h-5 lg:w-9 lg:h-5.5", className)}>
      <div className="scale-[0.65] lg:scale-75 origin-center shrink-0">
        <Switch
          aria-label="Toggle dark mode"
          icon={
            isDark ? (
              <MoonIcon className="h-3.5 w-3.5 text-[#202522] stroke-[2.2]" />
            ) : (
              <SunMediumIcon className="h-3.5 w-3.5 text-amber-500 stroke-[2.2]" />
            )
          }
          checked={isDark}
          onCheckedChange={toggleTheme}
          className="h-7 w-12 data-[state=checked]:bg-[#66CF11] data-[state=unchecked]:bg-[#D4D4C0] border border-transparent shadow-inner"
          thumbClassName="h-6 w-6 data-[state=checked]:translate-x-5 shadow-md flex items-center justify-center bg-white"
        />
      </div>
    </div>
  );
};

export default ThemeToggleSwitch;
