// forwardRef cache bust
import React, { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter = React.forwardRef<HTMLSpanElement, AnimatedCounterProps>(
  function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 0, duration = 1.2, className }, ref) {
    const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
    const display = useTransform(spring, (v) => {
      const formatted = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
      return `${prefix}${formatted}${suffix}`;
    });
    const [text, setText] = useState(`${prefix}0${suffix}`);

    useEffect(() => {
      spring.set(value);
    }, [value, spring]);

    useEffect(() => {
      const unsub = display.on("change", (v) => setText(v));
      return unsub;
    }, [display]);

    return <motion.span ref={ref} className={className}>{text}</motion.span>;
  }
);
AnimatedCounter.displayName = "AnimatedCounter";
