import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" className="h-full w-auto" aria-hidden="true">
        <defs>
          <linearGradient id="rd-gradient" x1="4" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-brand-600)" />
            <stop offset="1" stopColor="var(--color-cyan-accent)" />
          </linearGradient>
        </defs>
        <path
          d="M6 6h13a8 8 0 0 1 5.4 13.9L34 34h-9.4l-8-8.6H12V34H6Z"
          fill="url(#rd-gradient)"
        />
        <circle cx="17" cy="16.3" r="1.6" fill="var(--color-ink-950)" opacity="0.85" />
      </svg>
      {!iconOnly && (
        <span className="font-display text-xl font-semibold tracking-tight">
          Reply<span className="text-brand-500">Desk</span>
        </span>
      )}
    </span>
  );
}
