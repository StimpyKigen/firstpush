import type { MouseEvent, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Exact className for the fixed backdrop wrapper (bg color, blur, padding, z-index, alignment) — kept per-modal since these intentionally vary. */
  overlayClassName: string;
  /** Only set true for modals that already close on backdrop click; most in this app do not. */
  closeOnOverlayClick?: boolean;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, overlayClassName, closeOnOverlayClick = false, children }: ModalProps) {
  if (!isOpen) return null;

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (closeOnOverlayClick && onClose && e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className={overlayClassName} onClick={closeOnOverlayClick ? handleOverlayClick : undefined}>
      {children}
    </div>
  );
}
