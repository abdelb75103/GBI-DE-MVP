'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is narrower than the provided breakpoint.
 * Uses matchMedia when available and falls back to a simple width check.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`)
      : null;

    const update = () => {
      if (mediaQuery) {
        setIsMobile(mediaQuery.matches);
      } else if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < breakpoint);
      }
    };

    update();

    mediaQuery?.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      mediaQuery?.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, [breakpoint]);

  return isMobile;
}
