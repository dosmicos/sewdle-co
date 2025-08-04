import { motion } from "framer-motion";
import { ReactNode } from "react";
import { fadeUpVariants, getReducedMotionVariants, ANIMATION } from "@/lib/animations";

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const FadeUp = ({ children, delay = 0, className }: FadeUpProps) => {
  const variants = getReducedMotionVariants(fadeUpVariants);
  
  return (
    <motion.div
      className={className}
      initial="initial"
      whileInView="animate"
      viewport={ANIMATION.VIEWPORT}
      variants={variants}
      transition={{
        ...variants.animate.transition,
        delay
      }}
    >
      {children}
    </motion.div>
  );
};