

# Fix: AnimatedCounter forwardRef Warning

## Problem
One remaining `forwardRef` warning on the Landing page: `AnimatedCounter` is a plain function component that receives a ref from its parent in the `Landing` page.

## Fix

### `src/components/ceo/AnimatedCounter.tsx`
Wrap with `React.forwardRef`, pass ref to the root `motion.span` element, and add `displayName`.

```tsx
import React from "react";

export const AnimatedCounter = React.forwardRef<HTMLSpanElement, AnimatedCounterProps>(
  function AnimatedCounter({ value, prefix, suffix, decimals, duration, className }, ref) {
    // existing body
    return <motion.span ref={ref} className={className}>{text}</motion.span>;
  }
);
AnimatedCounter.displayName = "AnimatedCounter";
```

One file, minimal change, zero risk.

