// Animation constants for consistent, performant animations
export const ANIMATION = {
  // Durations (ms)
  DURATION: {
    FAST: 0.24,
    NORMAL: 0.3,
    SLOW: 0.36,
    SPRING: { stiffness: 100, damping: 15 }
  },
  
  // Easing
  EASING: "easeOut" as const,
  
  // Stagger timings
  STAGGER: {
    LETTERS: 0.014, // 14ms per character
    CARDS: 0.12,    // 120ms between cards
    BULLETS: 0.08,  // 80ms between bullets
    MOBILE_SCALE: 0.8 // 20% faster on mobile
  },
  
  // Movement distances
  DISTANCE: {
    FADE_UP: 16,
    CARD_CORNER: 16,
    SLIDE_TAB: 12,
    PARALLAX: 12,
    PARALLAX_MOBILE: 6
  },
  
  // Scale values
  SCALE: {
    CARD_INITIAL: 0.98,
    CARD_FINAL: 1.0,
    HOVER: 1.02,
    CENTRAL_MIN: 0.985
  },
  
  // Viewport settings
  VIEWPORT: {
    once: true,
    amount: 0.2
  }
} as const;

// Reduced motion variants
export const getReducedMotionVariants = (normalVariants: any) => {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return {
      initial: normalVariants.animate,
      animate: normalVariants.animate,
      exit: normalVariants.animate
    };
  }
  return normalVariants;
};

// Common animation variants
export const fadeUpVariants = {
  initial: { 
    opacity: 0, 
    y: ANIMATION.DISTANCE.FADE_UP 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: ANIMATION.DURATION.NORMAL,
      ease: ANIMATION.EASING
    }
  }
};

export const scaleInVariants = {
  initial: { 
    opacity: 0, 
    scale: ANIMATION.SCALE.CARD_INITIAL 
  },
  animate: { 
    opacity: 1, 
    scale: ANIMATION.SCALE.CARD_FINAL,
    transition: {
      duration: ANIMATION.DURATION.NORMAL,
      ease: ANIMATION.EASING
    }
  }
};

export const slideFromCornerVariants = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
  const x = corner.includes('r') ? ANIMATION.DISTANCE.CARD_CORNER : -ANIMATION.DISTANCE.CARD_CORNER;
  const y = corner.includes('b') ? ANIMATION.DISTANCE.CARD_CORNER : -ANIMATION.DISTANCE.CARD_CORNER;
  
  return {
    initial: { 
      opacity: 0, 
      x, 
      y 
    },
    animate: { 
      opacity: 1, 
      x: 0, 
      y: 0,
      transition: {
        duration: ANIMATION.DURATION.SLOW,
        ease: ANIMATION.EASING
      }
    }
  };
};