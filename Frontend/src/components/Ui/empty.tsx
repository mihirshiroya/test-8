import { createContext, useContext } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

type EmptySize = "sm" | "md" | "lg"

const EmptySizeContext = createContext<EmptySize>("md")

const useEmptySize = () => useContext(EmptySizeContext)

/*
 * Every Empty is an `@container/empty`, so each size also scales with the
 * width it is actually given (sidebar vs. full card) instead of the viewport.
 */
const emptyVariants = cva(
  "@container/empty flex w-full min-w-0 flex-1 flex-col items-center justify-center rounded-xl border-dashed text-center text-balance",
  {
    variants: {
      size: {
        sm: "min-h-32 gap-2 p-3",
        md: "min-h-48 gap-3 p-4 @sm/empty:p-6",
        lg: "min-h-72 gap-4 p-6 @md/empty:p-10",
      },
    },
    defaultVariants: { size: "md" },
  }
)

function Empty({
  className,
  size = "md",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>) {
  const resolvedSize = size ?? "md"

  return (
    <EmptySizeContext.Provider value={resolvedSize}>
      <div
        data-slot="empty"
        data-size={resolvedSize}
        className={cn(emptyVariants({ size: resolvedSize }), className)}
        {...props}
      />
    </EmptySizeContext.Provider>
  )
}

const emptyHeaderVariants = cva("flex w-full flex-col items-center", {
  variants: {
    size: {
      sm: "max-w-xs gap-1",
      md: "max-w-sm gap-1.5",
      lg: "max-w-md gap-2",
    },
  },
})

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  const size = useEmptySize()

  return (
    <div
      data-slot="empty-header"
      className={cn(emptyHeaderVariants({ size }), className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground",
        illustration: "bg-transparent *:mx-auto [&>*>svg]:size-full",
      },
      size: {
        sm: "mb-1",
        md: "mb-2",
        lg: "mb-3",
      },
    },
    compoundVariants: [
      {
        variant: "icon",
        size: "sm",
        className: "size-8 rounded-md [&_svg:not([class*='size-'])]:size-4",
      },
      {
        variant: "icon",
        size: "md",
        className: "size-10 rounded-lg [&_svg:not([class*='size-'])]:size-5",
      },
      {
        variant: "icon",
        size: "lg",
        className: "size-12 rounded-xl [&_svg:not([class*='size-'])]:size-6",
      },
      {
        variant: "illustration",
        size: "sm",
        className: "*:size-16 @xs/empty:*:size-20",
      },
      {
        variant: "illustration",
        size: "md",
        className: "*:size-24 @sm/empty:*:size-32",
      },
      {
        variant: "illustration",
        size: "lg",
        className: "*:size-32 @md/empty:*:size-40",
      },
    ],
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & Omit<VariantProps<typeof emptyMediaVariants>, "size">) {
  const size = useEmptySize()

  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, size }), className)}
      {...props}
    />
  )
}

const emptyTitleVariants = cva("tracking-tight text-foreground", {
  variants: {
    size: {
      sm: "text-xs font-semibold",
      md: "text-sm font-semibold @sm/empty:text-base",
      lg: "text-base font-semibold @md/empty:text-lg",
    },
  },
})

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  const size = useEmptySize()

  return (
    <div
      data-slot="empty-title"
      className={cn(emptyTitleVariants({ size }), className)}
      {...props}
    />
  )
}

const emptyDescriptionVariants = cva(
  "text-pretty text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
  {
    variants: {
      size: {
        sm: "text-[11px]/relaxed",
        md: "text-xs/relaxed @sm/empty:text-sm/relaxed",
        lg: "text-sm/relaxed @md/empty:text-base/relaxed",
      },
    },
  }
)

function EmptyDescription({ className, ...props }: React.ComponentProps<"div">) {
  const size = useEmptySize()

  return (
    <div
      data-slot="empty-description"
      className={cn(emptyDescriptionVariants({ size }), className)}
      {...props}
    />
  )
}

const emptyContentVariants = cva(
  "flex w-full min-w-0 flex-col items-center text-balance empty:hidden",
  {
    variants: {
      size: {
        sm: "max-w-xs gap-2 text-xs",
        md: "max-w-sm gap-2.5 text-sm",
        lg: "max-w-md gap-3 text-sm",
      },
    },
  }
)

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  const size = useEmptySize()

  return (
    <div
      data-slot="empty-content"
      className={cn(emptyContentVariants({ size }), className)}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  emptyVariants,
  type EmptySize,
}
