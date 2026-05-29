import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 transition-colors",
  {
    variants: {
      variant: {
        default: "border border-[#0a0a0a] text-[#0a0a0a]",
        muted: "border border-[#e5e5e5] text-[#6b6b6b]",
        sale: "bg-[#0a0a0a] text-white border border-[#0a0a0a]",
        rental: "bg-[#0a0a0a] text-white border border-[#0a0a0a]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
