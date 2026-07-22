import { Link } from "react-router-dom";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="ReplyDesk — início">
          <Logo className="h-7" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#beneficios" className="transition-colors hover:text-foreground">
            Benefícios
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild variant="glow" size="sm">
            <Link to="/register">Começar gratuitamente</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
