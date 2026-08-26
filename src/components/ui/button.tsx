import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Controls are panel-mounted, not painted on.
 *
 * Every variant sits on its own surface above the page, carries a real edge,
 * and compresses when pressed — the shadow collapses and the face drops a
 * pixel, so the press is felt rather than merely recoloured. The previous
 * outline variant used the page's own background with a hairline border at
 * about 1.15:1 against it, which meant most of the portal's actions were
 * invisible until hovered.
 *
 * Primary actions carry a lime bar along their bottom edge that collapses on
 * press. It is the same gesture as the sidebar's active-nav marker, reused
 * rather than invented twice, and it is the only decoration here.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center",
    "rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap select-none",
    // scale and translate are listed separately: Tailwind v4 emits them as
    // standalone CSS properties, not as a composed transform, so transitioning
    // "transform" alone leaves the pop snapping instantly.
    "transition-[background-color,border-color,box-shadow,color,scale,translate] duration-150 [transition-timing-function:var(--ease-pop)]",
    "transform-gpu will-change-transform",
    // Hovering raises the control over its neighbours so the pop is not
    // clipped by the next cell in a table.
    "hover:z-10",
    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    // The press. Menu triggers keep their position so the popup does not jump.
    "active:not-aria-[haspopup]:translate-y-px active:scale-[0.97] active:duration-75",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-transparent bg-primary text-primary-foreground",
          "shadow-[var(--control-dome),var(--control-lift-solid)]",
          // Darkens on hover. It used to lighten, which reads as receding.
          "hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]",
          "dark:hover:bg-[color-mix(in_oklch,var(--primary),white_12%)]",
          "hover:-translate-y-0.5 hover:scale-[1.04]",
          "hover:shadow-[var(--control-dome),var(--control-pop-solid)]",
          "active:shadow-[var(--control-lift-solid)]",
          // The detent bar.
          "after:pointer-events-none after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5",
          "after:rounded-full after:bg-brand-lime/70 after:transition-opacity after:duration-100",
          "hover:after:bg-brand-lime active:after:opacity-0",
          "dark:after:bg-brand-ink/40 dark:hover:after:bg-brand-ink/60",
        ],
        outline: [
          "border-[var(--control-edge)] bg-[var(--control-face)] text-foreground",
          "shadow-[var(--control-dome),var(--control-lift)]",
          "hover:border-[var(--control-edge-hover)] hover:bg-[var(--control-face-hover)]",
          "hover:-translate-y-0.5 hover:scale-[1.04]",
          "hover:shadow-[var(--control-dome),var(--control-pop)]",
          "active:shadow-[var(--control-lift)]",
          "aria-expanded:border-[var(--control-edge-hover)] aria-expanded:bg-[var(--control-face-hover)]",
        ],
        secondary: [
          "border-[color-mix(in_oklch,var(--secondary),var(--foreground)_52%)] bg-secondary text-secondary-foreground",
          "shadow-[var(--control-dome),var(--control-lift)]",
          "hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]",
          "hover:-translate-y-0.5 hover:scale-[1.04]",
          "hover:shadow-[var(--control-dome),var(--control-pop)]",
          "active:shadow-[var(--control-lift)] aria-expanded:bg-secondary",
        ],
        /**
         * Quiet, but never invisible. Icon-only menu triggers use this, and a
         * control with no resting state at all cannot be found without a
         * mouse to wave over it.
         */
        ghost: [
          // Outline, minus the lift. Quieter in the hierarchy, but still an
          // object with an edge — a control that only appears under the
          // cursor cannot be found by anyone not already waving at it.
          "border-[var(--control-edge)] bg-[var(--control-face)]/70 text-foreground",
          "hover:bg-[var(--control-face)] hover:border-[var(--control-edge-hover)]",
          "hover:-translate-y-0.5 hover:scale-[1.04]",
          "hover:shadow-[var(--control-dome),var(--control-pop)]",
          "active:shadow-[var(--control-lift)]",
          "aria-expanded:border-[var(--control-edge-hover)] aria-expanded:bg-[var(--control-face)]",
        ],
        destructive: [
          // Darkened from --destructive itself: the raw token on the pale red face
          // measures 3.93:1, under the 4.5 needed at this text size.
          "border-destructive/60 bg-destructive/10 text-[color-mix(in_oklch,var(--destructive),black_22%)]",
          "dark:text-destructive",
          "shadow-[var(--control-dome),var(--control-lift)]",
          "hover:border-destructive/80 hover:bg-destructive/18",
          "hover:-translate-y-0.5 hover:scale-[1.04]",
          "hover:shadow-[var(--control-dome),var(--control-pop)]",
          "active:shadow-[var(--control-lift)]",
          "focus-visible:border-destructive/50 focus-visible:ring-destructive/25",
          "dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        ],
        /**
         * For genuine in-text links. Underlined at rest, because a link that
         * only reveals itself on hover cannot be found by someone reading.
         */
        link: [
          "border-transparent text-primary underline decoration-primary/35 underline-offset-4",
          "shadow-none hover:decoration-primary hover:scale-100 active:translate-y-0 active:scale-100",
        ],
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
