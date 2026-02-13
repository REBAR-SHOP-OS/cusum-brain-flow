

# Fix: Badge forwardRef Warning

## Problem
The `Badge` component in `src/components/ui/badge.tsx` is a plain function component, but it's receiving a ref (likely from a parent). React warns that function components cannot be given refs without `React.forwardRef()`.

## Fix
Wrap the `Badge` component with `React.forwardRef` in `src/components/ui/badge.tsx`, matching the pattern already used by `Card`, `CardContent`, and other UI components in this project.

### Technical Detail
Change line 27-29 in `badge.tsx` from:
```tsx
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```
To:
```tsx
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = "Badge";
```

One file changed, zero risk.

