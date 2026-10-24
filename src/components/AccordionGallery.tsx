import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import './AccordionGallery.css';

export interface AccordionGalleryItem {
  image: string;
  label?: string;
  link?: string;
  alt?: string;
}

export interface AccordionGalleryProps {
  items?: AccordionGalleryItem[];
  defaultIndex?: number;
  accentColor?: string;
  overlayColor?: string;
  textColor?: string;
  height?: number;
  gap?: number;
  radius?: number;
  expandRatio?: number;
  orientation?: 'horizontal' | 'vertical';
  duration?: number;
  ease?: string;
  parallax?: number;
  tilt?: number;
  stagger?: number;
  trigger?: 'hover' | 'click';
  showLabels?: boolean;
  grayscale?: boolean;
  className?: string;
  mobileOrientation?: 'horizontal' | 'vertical';
}

const DEFAULT_ITEMS: AccordionGalleryItem[] = [
  { image: 'https://picsum.photos/id/1015/900/1200', label: 'Canyon', link: '#' },
  { image: 'https://picsum.photos/id/1018/900/1200', label: 'Ridgeline', link: '#' },
  { image: 'https://picsum.photos/id/1039/900/1200', label: 'Falls', link: '#' },
  { image: 'https://picsum.photos/id/1043/900/1200', label: 'Harbour', link: '#' },
  { image: 'https://picsum.photos/id/1044/900/1200', label: 'Skyline', link: '#' }
];

export const AccordionGallery: React.FC<AccordionGalleryProps> = ({
  items = DEFAULT_ITEMS,
  defaultIndex = 0,
  accentColor = '#006C54',
  overlayColor = '#060010',
  textColor = '#ffffff',
  height = 480,
  gap = 12,
  radius = 24,
  expandRatio = 0.75,
  orientation = 'horizontal',
  duration = 0.55,
  ease = 'power3.out',
  parallax = 0.5,
  tilt = 8,
  stagger = 0.05,
  showLabels = true,
  grayscale = true,
  className = '',
  mobileOrientation = 'horizontal',
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLElement | null)[]>([]);
  const barRefs = useRef<(HTMLElement | null)[]>([]);
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const firstRunRef = useRef(true);
  const mediaSizeRef = useRef(320);
  const lastDirectionRef = useRef<'next' | 'prev'>('next');

  // Touch and drag tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isMouseDownRef = useRef(false);
  const mouseStartX = useRef<number | null>(null);
  const didDragRef = useRef(false);

  const count = items ? items.length : 0;
  const [currentIndex, setCurrentIndex] = useState(() => (count > 0 ? (defaultIndex % count + count) % count : 0));

  // Keep index within bounds if items change
  useEffect(() => {
    if (count > 0) {
      setCurrentIndex((prev) => prev % count);
    }
  }, [count]);

  // Preload images for instant transitions
  useEffect(() => {
    if (typeof window !== 'undefined' && items) {
      items.forEach((item) => {
        if (item.image) {
          const img = new Image();
          img.src = item.image;
        }
      });
    }
  }, [items]);

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const vertical = orientation === 'vertical';

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (count <= 1) return;
    lastDirectionRef.current = 'next';
    setCurrentIndex((prev) => (prev + 1) % count);
  }, [count]);

  const handlePrev = useCallback(() => {
    if (count <= 1) return;
    lastDirectionRef.current = 'prev';
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  const handleSelectSlot = useCallback(
    (slotOffset: number) => {
      if (slotOffset === 0 || count <= 1) return;
      lastDirectionRef.current = 'next';
      setCurrentIndex((prev) => (prev + slotOffset) % count);
    },
    [count]
  );

  // Compute circular order starting with the dominant card at slot 0
  const orderedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const list: { item: AccordionGalleryItem; originalIndex: number; slotIndex: number }[] = [];
    for (let offset = 0; offset < count; offset++) {
      const originalIndex = (currentIndex + offset) % count;
      list.push({
        item: items[originalIndex],
        originalIndex,
        slotIndex: offset,
      });
    }
    return list;
  }, [items, currentIndex, count]);

  const applyLayout = useCallback(
    (animate: boolean) => {
      const panels = panelRefs.current;
      if (!panels.length) return;

      const r = Math.min(Math.max(expandRatio, 0.2), 0.9);
      const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
      const mediaSize = mediaSizeRef.current;

      tlRef.current?.kill();
      const dur = animate && !prefersReduced ? duration : 0;
      const tl = gsap.timeline();

      panels.forEach((panel, slotIndex) => {
        if (!panel) return;
        const isActive = slotIndex === 0;
        const media = mediaRefs.current[slotIndex];
        const bar = barRefs.current[slotIndex];
        const text = textRefs.current[slotIndex];

        // Slot 0 is dominant facing straight; following standby cards tilt gently
        const rot = isActive ? 0 : -tilt;
        const rotProp = vertical ? { rotateX: -rot } : { rotateY: rot };

        tl.to(panel, { flexGrow: isActive ? grow : 1, ...rotProp, duration: dur, ease }, 0);

        if (media) {
          const shift = isActive ? 0 : -parallax * mediaSize * 0.05;
          const gray = grayscale ? (isActive ? 0 : 1) : 0;
          const dim = isActive ? 0 : 0.35;

          if (isActive && animate && !firstRunRef.current) {
            const slideX = lastDirectionRef.current === 'next' ? 28 : -28;
            tl.fromTo(
              media,
              {
                xPercent: -50,
                yPercent: -50,
                x: vertical ? 0 : slideX,
                y: vertical ? slideX : 0,
                '--ag-gray': gray,
                '--ag-dim': dim,
              },
              {
                xPercent: -50,
                yPercent: -50,
                x: 0,
                y: 0,
                '--ag-gray': gray,
                '--ag-dim': dim,
                duration: dur,
                ease,
              },
              0
            );
          } else {
            tl.to(
              media,
              {
                xPercent: -50,
                yPercent: -50,
                x: vertical ? 0 : shift,
                y: vertical ? shift : 0,
                '--ag-gray': gray,
                '--ag-dim': dim,
                duration: dur,
                ease,
              },
              0
            );
          }
        }

        if (showLabels && bar && text) {
          if (isActive) {
            if (animate && !firstRunRef.current) {
              tl.fromTo(
                [bar, text],
                { opacity: 0, x: -14 },
                { opacity: 1, x: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger },
                0.04
              );
            } else {
              tl.to(
                [bar, text],
                { opacity: 1, x: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger },
                0
              );
            }
          } else {
            tl.to([bar, text], { opacity: 0, x: -14, duration: dur * 0.5, ease }, 0);
          }
        }
      });

      tlRef.current = tl;
    },
    [
      count,
      expandRatio,
      duration,
      ease,
      vertical,
      tilt,
      parallax,
      grayscale,
      showLabels,
      stagger,
      prefersReduced,
    ]
  );

  // Resize measurement
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const total = vertical ? rect.height : rect.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(140, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.22);
      mediaSizeRef.current = size;
      el.style.setProperty('--ag-media-size', `${size}px`);
      applyLayout(!firstRunRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyLayout, gap, count, expandRatio, vertical]);

  // Layout updates when currentIndex changes
  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [currentIndex, applyLayout]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    []
  );

  // Card click handler
  const handleClick = (slotIndex: number, e: React.MouseEvent) => {
    if (didDragRef.current) {
      e.preventDefault();
      didDragRef.current = false;
      return;
    }

    if (slotIndex > 0) {
      // Standby card clicked: toggle it into slot 0
      e.preventDefault();
      handleSelectSlot(slotIndex);
    } else {
      // Dominant card clicked: only prevent default if no destination link
      const activeItem = orderedItems[0]?.item;
      if (!activeItem?.link || activeItem.link === '#') {
        e.preventDefault();
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      handlePrev();
    }
  };

  // Mobile Touch Swipe Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
    didDragRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = (touchStartY.current || 0) - (touchEndY.current || 0);

    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      didDragRef.current = true;
      if (diffX > 0) {
        // Swiped left -> Next item (advances circularly)
        handleNext();
      } else {
        // Swiped right -> Previous item (swiping back, loops back at end)
        handlePrev();
      }
    }
  };

  // Desktop Mouse Drag Handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDownRef.current = true;
    mouseStartX.current = e.clientX;
    didDragRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || mouseStartX.current === null) return;
    const diffX = mouseStartX.current - e.clientX;
    if (Math.abs(diffX) > 10) {
      didDragRef.current = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || mouseStartX.current === null) {
      isMouseDownRef.current = false;
      return;
    }
    const diffX = mouseStartX.current - e.clientX;
    isMouseDownRef.current = false;
    mouseStartX.current = null;

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  if (!items || items.length === 0) {
    return null;
  }

  const isMobileVertical = mobileOrientation === 'vertical';

  return (
    <div
      ref={rootRef}
      className={`accordion-gallery${vertical ? ' accordion-gallery--vertical' : ''}${
        isMobileVertical ? ' accordion-gallery--mobile-vertical' : ''
      }${className ? ` ${className}` : ''}`}
      style={{
        ['--ag-accent' as any]: accentColor,
        ['--ag-overlay' as any]: overlayColor,
        ['--ag-text' as any]: textColor,
        ['--ag-gap' as any]: `${gap}px`,
        ['--ag-radius' as any]: `${radius}px`,
        height: vertical ? `${Math.round(height * 1.4)}px` : `${height}px`
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image accordion gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {orderedItems.map(({ item, slotIndex }) => {
        const isActive = slotIndex === 0;
        const Tag = isActive && item.link && item.link !== '#' ? 'a' : 'div';
        return (
          <Tag
            key={slotIndex}
            ref={(el) => { panelRefs.current[slotIndex] = el; }}
            className={`ag-panel${isActive ? ' ag-panel--active' : ' ag-panel--standby'}`}
            style={{ borderRadius: `${radius}px` }}
            href={isActive && item.link && item.link !== '#' ? item.link : undefined}
            onClick={(e: React.MouseEvent) => handleClick(slotIndex, e)}
            role={isActive ? undefined : 'button'}
            tabIndex={0}
            aria-current={isActive ? 'true' : undefined}
            aria-label={isActive ? (item.label || 'Dominant story') : `Show story: ${item.label || ''}`}
          >
            <span className="ag-panel__frame">
              <span className="ag-panel__media" ref={(el) => { mediaRefs.current[slotIndex] = el; }}>
                <img
                  src={item.image}
                  alt={item.alt || item.label || ''}
                  draggable="false"
                  loading="eager"
                />
              </span>
              <span className="ag-panel__overlay" aria-hidden="true" />
            </span>
            {showLabels && (
              <span className="ag-panel__label" aria-hidden="true">
                <span className="ag-panel__bar" ref={(el) => { barRefs.current[slotIndex] = el; }} />
                <span className="ag-panel__text" ref={(el) => { textRefs.current[slotIndex] = el; }}>
                  {item.label}
                </span>
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
};

export default AccordionGallery;

