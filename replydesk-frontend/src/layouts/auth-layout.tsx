import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(69,212,247,0.16),transparent)]"
          aria-hidden
        />
        <Link to="/" className="relative z-10">
          <Logo className="h-7" />
        </Link>
        <div className="relative z-10 max-w-sm">
          <p className="font-display text-2xl font-medium leading-snug">
            "O ReplyDesk assumiu as perguntas repetitivas e nosso time passou a focar só nos casos que
            importam."
          </p>
          <p className="mt-4 text-sm text-white/60">Equipe de atendimento, cliente ReplyDesk</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/">
              <Logo className="h-7" />
            </Link>
            <ThemeToggle />
          </div>

          <div className="hidden justify-end lg:flex">
            <ThemeToggle />
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  );
}
