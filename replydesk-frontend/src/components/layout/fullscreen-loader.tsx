import { Logo } from "@/components/layout/logo";

export function FullscreenLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
      <Logo className="h-8 w-auto animate-pulse" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/3 animate-[flow_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-brand-500 to-cyan-accent" />
      </div>
    </div>
  );
}
