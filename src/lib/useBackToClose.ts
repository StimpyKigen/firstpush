import { useEffect, useRef } from 'react';
import {
  pushOverlayToBackStack,
  updateOverlayCloseCallback,
  removeOverlayFromBackStack,
} from './navigationHistory';

let overlayCounter = 0;

/**
 * Intercepts browser/hardware Back button when a modal, drawer, reel, or overlay is open
 * so pressing Back closes ONLY the topmost active overlay instead of navigating away
 * or corrupting React Router's `window.history.state.idx`.
 */
export function useBackToClose(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const overlayIdRef = useRef<string | null>(null);
  if (!overlayIdRef.current) {
    overlayCounter += 1;
    overlayIdRef.current = `mshindi-overlay-${overlayCounter}`;
  }

  useEffect(() => {
    const id = overlayIdRef.current!;
    if (!isOpen || !onCloseRef.current) {
      return;
    }

    pushOverlayToBackStack(id, () => {
      onCloseRef.current?.();
    });

    return () => {
      removeOverlayFromBackStack(id);
    };
  }, [isOpen]);

  useEffect(() => {
    const id = overlayIdRef.current!;
    if (isOpen && onClose) {
      updateOverlayCloseCallback(id, () => {
        onCloseRef.current?.();
      });
    }
  }, [isOpen, onClose]);
}
