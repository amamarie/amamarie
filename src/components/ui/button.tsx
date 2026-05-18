import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 text-sm font-black ring-offset-background transition active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-emerald-600 bg-emerald-500 text-white shadow-[0_4px_0_#16a34a] hover:bg-emerald-600",
        destructive:
          "border-rose-600 bg-rose-500 text-white shadow-[0_4px_0_#e11d48] hover:bg-rose-600",
        outline:
          "border-slate-200 bg-white text-slate-800 shadow-[0_4px_0_#e2e8f0] hover:bg-lime-50 hover:text-slate-950",
        secondary:
          "border-lime-300 bg-lime-100 text-lime-950 shadow-[0_4px_0_#bef264] hover:bg-lime-200",
        ghost: "border-transparent bg-transparent text-slate-700 shadow-none hover:bg-lime-100 hover:text-slate-950",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
