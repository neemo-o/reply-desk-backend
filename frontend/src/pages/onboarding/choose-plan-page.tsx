import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { OnboardingLayout } from "@/layouts/onboarding-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlans } from "@/hooks/use-plans";
import { subscriptionsService } from "@/services/subscriptions-service";
import { extractApiErrorMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import type { BillingType } from "@/types/billing";

function formatPrice(price: string | number) {
  return Number(price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ChoosePlanPage() {
  const { data: plans, isLoading } = usePlans();
  const [billingType, setBillingType] = useState<BillingType>("recurring");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    setLoadingPlanId(planId);
    try {
      const { checkoutUrl } = await subscriptionsService.createCheckout(planId, billingType);
      window.location.href = checkoutUrl;
    } catch (error) {
      const message = extractApiErrorMessage(error, "Não foi possível iniciar o pagamento agora");
      toast.error(message);
      setLoadingPlanId(null);
    }
  }

  return (
    <OnboardingLayout
      title="Escolha seu plano"
      subtitle="Selecione o plano ideal para o seu time começar a atender no ReplyDesk"
    >
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => setBillingType("recurring")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              billingType === "recurring" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Mensal recorrente
          </button>
          <button
            type="button"
            onClick={() => setBillingType("one_time")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              billingType === "one_time" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Pagamento único (1 mês)
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {plans?.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-display text-xl">{plan.name}</CardTitle>
                <p className="mt-1">
                  <span className="text-3xl font-semibold tracking-tight">{formatPrice(plan.price)}</span>
                  <span className="text-sm text-muted-foreground">
                    {billingType === "recurring" ? "/mês" : " (1 mês de acesso)"}
                  </span>
                </p>
              </CardHeader>
              <CardContent className="flex-1 space-y-2.5">
                {[
                  `${plan.maxSessions} sessões de WhatsApp`,
                  `${plan.maxUsers} usuários no time`,
                  `${plan.maxBots} bots automatizados`,
                  `${plan.maxMessages.toLocaleString("pt-BR")} mensagens/mês`,
                  `${plan.maxStorageMb} MB de armazenamento`,
                  `${plan.maxAiRequests} requisições de IA/mês`,
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-brand-500" />
                    {feature}
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button
                  variant="glow"
                  className="w-full"
                  disabled={loadingPlanId !== null}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {loadingPlanId === plan.id && <Loader2 className="animate-spin" />}
                  Assinar {plan.name}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </OnboardingLayout>
  );
}
