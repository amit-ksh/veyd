import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CircularLoaderProps extends HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "brand" | "primary" | "white" | "muted";
  label?: string;
  sublabel?: string;
  className?: string;
}

const sizeMap = {
  xs: { box: "w-4 h-4", stroke: 3, r: 7 },
  sm: { box: "w-5 h-5", stroke: 3, r: 8 },
  md: { box: "w-8 h-8", stroke: 3, r: 12 },
  lg: { box: "w-11 h-11", stroke: 3.5, r: 16 },
  xl: { box: "w-14 h-14", stroke: 4, r: 20 },
};

const variantMap = {
  brand: {
    track: "stroke-cyan-100",
    indicator: "stroke-[#00c9d2]",
    dot: "bg-[#00c9d2]",
  },
  primary: {
    track: "stroke-slate-200",
    indicator: "stroke-slate-900",
    dot: "bg-slate-900",
  },
  white: {
    track: "stroke-white/20",
    indicator: "stroke-white",
    dot: "bg-white",
  },
  muted: {
    track: "stroke-slate-100",
    indicator: "stroke-slate-400",
    dot: "bg-slate-400",
  },
};

export function CircularLoader({
  size = "md",
  variant = "brand",
  label,
  sublabel,
  className,
  ...props
}: CircularLoaderProps) {
  const s = sizeMap[size];
  const v = variantMap[variant];

  return (
    <div
      role="status"
      aria-label={label || "Loading"}
      className={cn("inline-flex flex-col items-center justify-center gap-2.5", className)}
      {...props}
    >
      <div className={cn("relative flex items-center justify-center shrink-0", s.box)}>
        <svg
          className="w-full h-full animate-spin motion-reduce:animate-none"
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background Track */}
          <circle
            cx="25"
            cy="25"
            r="20"
            className={v.track}
            strokeWidth={s.stroke * 1.3}
          />
          {/* Foreground Spinning Arc */}
          <circle
            cx="25"
            cy="25"
            r="20"
            className={v.indicator}
            strokeWidth={s.stroke * 1.3}
            strokeLinecap="round"
            strokeDasharray="90 150"
          />
        </svg>
      </div>

      {(label || sublabel) && (
        <div className="text-center space-y-0.5">
          {label && (
            <p className="text-xs font-semibold text-slate-800 tracking-tight">
              {label}
            </p>
          )}
          {sublabel && (
            <p className="text-[11px] text-slate-500 leading-normal max-w-xs">
              {sublabel}
            </p>
          )}
        </div>
      )}
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}

export function ProcessingOverlay({
  label = "Processing…",
  sublabel,
}: {
  label?: string;
  sublabel?: string;
}) {
  return (
    <div
      className="absolute inset-0 bg-white/80 backdrop-blur-xs z-30 rounded-xl flex items-center justify-center p-6 text-center animate-in fade-in duration-200"
      aria-live="polite"
    >
      <CircularLoader size="lg" variant="brand" label={label} sublabel={sublabel} />
    </div>
  );
}
