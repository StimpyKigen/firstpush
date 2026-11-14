import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Dot } from "lucide-react";
import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
  React.ComponentRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName
    )}
    className={cn(
      "disabled:cursor-not-allowed !text-transparent !opacity-0 !caret-transparent selection:bg-transparent selection:text-transparent [-webkit-text-fill-color:transparent]",
      className
    )}
    {...props}
  />
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number; mask?: boolean }
>(({ index, className, mask = true, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const slot = inputOTPContext?.slots?.[index];
  const char = slot?.char ?? null;
  const hasFakeCaret = !!slot?.hasFakeCaret;
  const isActive = !!slot?.isActive;

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center border border-[#DCDCC8] dark:border-line bg-white dark:bg-panel text-base font-bold text-slate-900 dark:text-cream shadow-2xs transition-all rounded-md",
        isActive && "z-10 ring-2 ring-[#006C54] dark:ring-emerald-400 border-[#006C54] dark:border-emerald-400",
        className
      )}
      {...props}
    >
      {char ? (
        mask ? (
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-cream inline-block" />
        ) : (
          char
        )
      ) : null}
      {hasFakeCaret && !char && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-pulse bg-[#006C54] dark:bg-emerald-400 duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
  React.ComponentRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Dot />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
