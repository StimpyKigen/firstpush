import * as React from 'react';
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from '@shadcn/react/message-scroller';
import { ArrowDown } from 'lucide-react';

export const MessageScrollerProvider = MessageScrollerPrimitive.Provider;

export const MessageScroller = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MessageScrollerPrimitive.Root>
>(({ className = '', ...props }, ref) => (
  <MessageScrollerPrimitive.Root
    ref={ref}
    className={`group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden ${className}`}
    {...props}
  />
));
MessageScroller.displayName = 'MessageScroller';

export const MessageScrollerViewport = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>
>(({ className = '', ...props }, ref) => (
  <MessageScrollerPrimitive.Viewport
    ref={ref}
    className={`size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain scroll-smooth ${className}`}
    {...props}
  />
));
MessageScrollerViewport.displayName = 'MessageScrollerViewport';

export const MessageScrollerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MessageScrollerPrimitive.Content>
>(({ className = '', ...props }, ref) => (
  <MessageScrollerPrimitive.Content
    ref={ref}
    className={`flex h-max min-h-full flex-col gap-3 py-1 ${className}`}
    {...props}
  />
));
MessageScrollerContent.displayName = 'MessageScrollerContent';

export const MessageScrollerItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MessageScrollerPrimitive.Item>
>(({ className = '', scrollAnchor = false, ...props }, ref) => (
  <MessageScrollerPrimitive.Item
    ref={ref}
    scrollAnchor={scrollAnchor}
    className={`min-w-0 shrink-0 ${className}`}
    {...props}
  />
));
MessageScrollerItem.displayName = 'MessageScrollerItem';

export const MessageScrollerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof MessageScrollerPrimitive.Button>
>(({ className = '', children, direction = 'end', ...props }, ref) => (
  <MessageScrollerPrimitive.Button
    ref={ref}
    direction={direction}
    className={`absolute left-1/2 -translate-x-1/2 bottom-3 z-20 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wide shadow-lg border border-slate-700 transition-all active:scale-95 cursor-pointer data-[active=false]:pointer-events-none data-[active=false]:opacity-0 data-[active=false]:translate-y-2 data-[active=true]:opacity-100 data-[active=true]:translate-y-0 ${className}`}
    {...props}
  >
    {children ?? (
      <>
        <ArrowDown size={14} className="stroke-[2.5]" />
        <span>New comments</span>
      </>
    )}
  </MessageScrollerPrimitive.Button>
));
MessageScrollerButton.displayName = 'MessageScrollerButton';

export {
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
