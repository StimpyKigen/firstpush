import * as React from 'react';
import { motion, type Variants } from 'motion/react';

export interface BadgeCheckProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  animateOnHover?: boolean;
  loop?: boolean;
}

const badgeVariants: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 0.93, 1],
    transition: {
      duration: 1.6,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: 2.2,
    },
  },
  hover: {
    scale: [1, 0.88, 1.05, 1],
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

const checkVariants: Variants = {
  initial: { pathLength: 1, opacity: 1 },
  animate: {
    pathLength: [1, 0, 1],
    opacity: [1, 0.35, 1],
    transition: {
      duration: 1.6,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: 2.2,
    },
  },
  hover: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.45,
      ease: 'easeOut',
    },
  },
};

export const BadgeCheck = React.forwardRef<SVGSVGElement, BadgeCheckProps>(
  (
    {
      size = 18,
      className = 'w-4 h-4 sm:w-[17px] sm:h-[17px] text-emerald-400 shrink-0 drop-shadow-xs',
      animateOnHover = true,
      loop = true,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
      <motion.svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        onMouseEnter={() => {
          if (animateOnHover) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (animateOnHover) setIsHovered(false);
        }}
        {...(props as any)}
      >
        <motion.path
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          variants={badgeVariants}
          initial="initial"
          animate={isHovered ? 'hover' : loop ? 'animate' : 'initial'}
        />
        <motion.path
          d="m9 12 2 2 4-4"
          variants={checkVariants}
          initial="initial"
          animate={isHovered ? 'hover' : loop ? 'animate' : 'initial'}
        />
      </motion.svg>
    );
  }
);

BadgeCheck.displayName = 'BadgeCheck';

export const BadgeCheckIcon = BadgeCheck;
export type BadgeCheckIconProps = BadgeCheckProps;
export default BadgeCheck;

