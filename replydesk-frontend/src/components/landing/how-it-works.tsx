import { QrCode, Settings2, Sparkles } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: QrCode,
    title: "Conecte seu WhatsApp",
    description: "Escaneie um QR code e conecte o número da sua empresa em menos de dois minutos.",
  },
  {
    number: "02",
    icon: Settings2,
    title: "Configure seus fluxos",
    description: "Defina as respostas automáticas e as regras de encaminhamento para sua equipe.",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Automatize seu atendimento",
    description: "O ReplyDesk assume as conversas repetitivas e libera seu time para o que importa.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y border-border bg-secondary/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Como funciona</h2>
          <p className="mt-3 text-muted-foreground">Três passos entre criar sua conta e receber a primeira resposta automática.</p>
        </div>

        <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          <div
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            aria-hidden
          />
          {steps.map(({ number, icon: Icon, title, description }) => (
            <div key={number} className="relative flex flex-col items-center text-center md:items-start md:text-left">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-brand-500/30 bg-background text-brand-500 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <span className="mt-4 font-mono text-xs font-medium text-muted-foreground">{number}</span>
              <h3 className="mt-1 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
