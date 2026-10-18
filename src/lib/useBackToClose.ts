import { useEffect, useRef } from 'react';

/**
 * Hook to ensure pressing the hardware or browser Back button closes
 * an open overlay or modal first instead of navigating the user away.
 */
export function useBackToClose(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isPoppingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !onCloseRef.current || typeof window === 'undefined') return;

    const stateId = `modal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    window.history.pushState({ modalId: stateId }, '');

    const handlePopState = () => {
      isPoppingRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If modal was closed from UI rather than popstate, pop the history state
      if (!isPoppingRef.current && window.history.state?.modalId === stateId) {
        window.history.back();
      }
      isPoppingRef.current = false;
    };
  }, [isOpen]);
}
