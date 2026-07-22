import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CallToAction() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-ink-900 to-ink-800 px-8 py-14 text-center dark:from-ink-950 dark:to-ink-900">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(69,212,247,0.18),transparent)]"
          aria-hidden
        />
        <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pronto para automatizar seu atendimento?
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-white/70">
          Crie sua conta gratuita e conecte seu primeiro WhatsApp hoje mesmo.
        </p>
        <Button asChild size="lg" variant="glow" className="relative mt-8">
          <Link to="/register">
            Criar minha conta
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}
