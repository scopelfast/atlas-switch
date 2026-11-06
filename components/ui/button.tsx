import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";;
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:ring-indigo-200 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-indigo-500/40",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-200 dark:bg-red-500 dark:hover:bg-red-400 dark:focus-visible:ring-red-500/40",
        outline:
          "border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-200 dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:focus-visible:ring-slate-600/40",
        secondary:
          "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:ring-slate-100/60",
        ghost:
          "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-200 dark:text-slate-200 dark:hover:bg-slate-800/70 dark:hover:text-white dark:focus-visible:ring-slate-700/40",
        link: "text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
      },
      size: {
        default: "h-11 px-6 py-2 has-[>svg]:px-5",
        sm: "h-10 px-5 gap-1.5 has-[>svg]:px-4",
        lg: "h-12 px-8 has-[>svg]:px-6",
        icon: "size-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
