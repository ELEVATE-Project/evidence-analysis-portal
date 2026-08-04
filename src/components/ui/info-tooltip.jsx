import * as React from "react"
import { Info } from "lucide-react"

import { cn } from "../../lib/utils"

/**
 * Small hover/focus-triggered info icon + tooltip. CSS-only (Tailwind group-hover /
 * group-focus-within) — no extra dependency, since @radix-ui/react-tooltip isn't
 * installed and this codebase reserves MUI for DataGrid tables only.
 */
const InfoTooltip = React.forwardRef(
  ({ className, panelClassName, content, side = "right", label = "More info", ...props }, ref) => (
    <span className={cn("group relative inline-flex", className)} {...props}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className="inline-flex items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute z-50 w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:w-80",
          // Below `sm:` there isn't reliably room to open beside the icon without
          // running off a phone-width viewport, so every `side` value opens
          // centered below the icon on mobile; `side` only takes effect at `sm:`
          // and up, where a 320px-wide panel actually fits beside the icon.
          "left-1/2 top-full mt-2 -translate-x-1/2",
          side === "right" && "sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:-translate-y-1/2 sm:translate-x-0",
          panelClassName
        )}
      >
        {content}
      </span>
    </span>
  )
)
InfoTooltip.displayName = "InfoTooltip"

export { InfoTooltip }
