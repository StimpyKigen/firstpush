import { useEffect } from 'react';

/**
 * Global viewport scroll-into-view hook for interactive inputs.
 * Ensures that whenever a text input, password, searchbar, comment textarea,
 * or contenteditable element is focused or activated (especially on mobile devices
 * when virtual keyboards slide up), the field is centered cleanly into view.
 */
export function useAutoScrollIntoView() {
  useEffect(() => {
    function isEditableInput(el: unknown): el is HTMLElement {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      if (el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLInputElement) {
        const nonTextTypes = ['checkbox', 'radio', 'hidden', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];
        return !nonTextTypes.includes(el.type.toLowerCase());
      }
      return false;
    }

    function scrollTargetIntoView(target: HTMLElement) {
      try {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      } catch {
        target.scrollIntoView();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!isEditableInput(target)) return;

      // 1. Immediate microtask scroll check
      requestAnimationFrame(() => {
        scrollTargetIntoView(target);
      });

      // 2. Delayed scroll after mobile virtual keyboard finishes opening (~280-320ms)
      const timer = setTimeout(() => {
        if (document.activeElement === target) {
          scrollTargetIntoView(target);
        }
      }, 300);

      // 3. VisualViewport resize handler for mobile virtual keyboard height adjustment
      const vv = window.visualViewport;
      if (vv) {
        const onViewportResize = () => {
          if (document.activeElement === target) {
            scrollTargetIntoView(target);
          }
        };
        vv.addEventListener('resize', onViewportResize, { once: true });
      }

      const onBlur = () => {
        clearTimeout(timer);
        target.removeEventListener('blur', onBlur);
      };
      target.addEventListener('blur', onBlur, { once: true });
    }

    window.addEventListener('focusin', handleFocusIn, { passive: true });

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, []);
}

