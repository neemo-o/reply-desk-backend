import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutomationFlowVisual } from "./automation-flow-visual";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(33,102,240,0.16),transparent)]"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Atendimento no WhatsApp, no piloto automático
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Seu WhatsApp, respondendo sozinho —{" "}
            <span className="bg-gradient-to-r from-brand-600 to-cyan-accent bg-clip-text text-transparent">
              sem perder o toque humano
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            O ReplyDesk conecta seus números de WhatsApp a bots inteligentes que entendem, respondem
            e encaminham conversas — para uma ou várias empresas, em um único painel.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" variant="glow">
              <Link to="/register">
                Começar gratuitamente
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>

        <div className="animate-fade-up [animation-delay:150ms]">
          <AutomationFlowVisual />
        </div>
      </div>
    </section>
  );
}
