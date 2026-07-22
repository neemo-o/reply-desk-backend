export function AutomationFlowVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/20 via-cyan-accent/10 to-transparent blur-2xl" />

      <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-xl backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          Sessão conectada · +55 11 9****-0000
        </div>

        {/* Mensagem recebida do cliente */}
        <div className="mb-3 flex justify-start">
          <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
            Oi! Vocês têm horário amanhã à tarde?
          </div>
        </div>

        {/* Nó de automação/roteamento */}
        <div className="my-4 flex items-center gap-3 pl-1">
          <svg width="28" height="40" viewBox="0 0 28 40" className="shrink-0 text-brand-500/70">
            <path
              d="M14 0v14"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="animate-flow"
            />
          </svg>
          <div className="flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-brand-500" />
            </span>
            <span className="font-mono text-[11px] font-medium text-brand-600 dark:text-brand-300">
              bot: identificando intenção
            </span>
          </div>
        </div>

        {/* Resposta automática */}
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2.5 text-sm text-white shadow-sm">
            Temos vaga às 14h e às 16h. Qual prefere? 😊
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>Respondido automaticamente</span>
          <span className="font-mono">0,8s</span>
        </div>
      </div>
    </div>
  );
}
