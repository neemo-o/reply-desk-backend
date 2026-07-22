import { Bot, Building2, MessagesSquare, Sparkles, Wand2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

const benefits = [
  {
    icon: MessagesSquare,
    title: "Atendimento automatizado",
    description: "Respostas instantâneas para as perguntas mais comuns, 24 horas por dia, sem fila de espera.",
  },
  {
    icon: Bot,
    title: "Bots inteligentes",
    description: "Fluxos que entendem intenção e contexto, e passam para um humano no momento certo.",
  },
  {
    icon: Zap,
    title: "Integração com WhatsApp",
    description: "Conecte números existentes em minutos, sem precisar trocar de aparelho ou número.",
  },
  {
    icon: Building2,
    title: "Multiempresas",
    description: "Gerencie o atendimento de várias marcas ou filiais a partir de um único painel.",
  },
  {
    icon: Sparkles,
    title: "IA integrada",
    description: "Sugestões de resposta e triagem automática apoiadas por modelos de linguagem.",
  },
  {
    icon: Wand2,
    title: "Fácil configuração",
    description: "Sem código: monte seus fluxos de atendimento em um editor visual simples.",
  },
];

export function Benefits() {
  return (
    <section id="beneficios" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tudo que seu atendimento precisa
        </h2>
        <p className="mt-3 text-muted-foreground">
          Menos tarefas repetitivas para o seu time, mais respostas rápidas para quem manda mensagem.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map(({ icon: Icon, title, description }) => (
          <Card
            key={title}
            className="group p-6 transition-colors hover:border-brand-500/40"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/15 to-cyan-accent/15 text-brand-500 transition-colors group-hover:from-brand-500/25 group-hover:to-cyan-accent/25">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
