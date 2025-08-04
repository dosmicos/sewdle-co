import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

interface TickerProps {
  items: string[];
  speed?: number;
  className?: string;
}

export const Ticker = ({ items, speed = 50, className }: TickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  
  // Scroll-linked acceleration: 15-25% faster when scrolling down
  const scrollVelocity = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  
  const duplicatedItems = [...items, ...items];

  return (
    <div className={`overflow-hidden ${className}`} ref={containerRef}>
      <motion.div
        className="flex whitespace-nowrap"
        animate={{
          x: [0, -50 + "%"]
        }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop"
        }}
        style={{
          scaleX: scrollVelocity
        }}
        whileHover={{ 
          animationPlayState: "paused",
          transition: { duration: 0.2 }
        }}
      >
        {duplicatedItems.map((item, index) => (
          <div
            key={index}
            className="flex-shrink-0 px-8 py-4 text-muted-foreground font-medium"
          >
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
};