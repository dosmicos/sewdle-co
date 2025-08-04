import { motion } from "framer-motion";
import { ANIMATION, getReducedMotionVariants } from "@/lib/animations";

interface LetterRevealProps {
  text: string;
  className?: string;
  delay?: number;
}

export const LetterReveal = ({ text, className, delay = 0 }: LetterRevealProps) => {
  const letterVariants = {
    initial: { 
      opacity: 0, 
      y: 10 
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
  
  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: ANIMATION.STAGGER.LETTERS,
        delayChildren: delay
      }
    }
  };

  const variants = getReducedMotionVariants(containerVariants);
  const charVariants = getReducedMotionVariants(letterVariants);

  return (
    <motion.span
      className={className}
      variants={variants}
      initial="initial"
      whileInView="animate"
      viewport={ANIMATION.VIEWPORT}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          variants={charVariants}
          style={{ display: 'inline-block' }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
};