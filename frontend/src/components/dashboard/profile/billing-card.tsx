import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/use-subscription";
import { usePlans } from "@/hooks/use-plans";
import { subscriptionsService } from "@/services/subscriptions-service";
import { extractApiErrorMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  active: { label: "Ativa", variant: "success" },
  trialing: { label: "Em teste grátis", variant: "success" },
  past_due: { label: "Pagamento pendente", variant: "warning" },
  pending: { label: "Aguardando pagamento", variant: "warning" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function formatPrice(price: string | number) {
  return Number(price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("pt-BR");
}

export function BillingCard() {
  const queryClient = useQueryClient();
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();
  const { data: plans, isLoading: isLoadingPlans } = usePlans();
  const [actionPlanId, setActionPlanId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  async function invalidateSubscription() {
    await queryClient.invalidateQueries({ queryKey: ["subscriptions", "me"] });
  }

  async function handleUpgrade(planId: string) {
    setActionPlanId(planId);
    try {
      await subscriptionsService.upgradePlan(planId);
      await invalidateSubscription();
      toast.success("Plano atualizado com sucesso");
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Não foi possível alterar o plano agora"));
    } finally {
      setActionPlanId(null);
    }
  }

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await subscriptionsService.cancel();
      await invalidateSubscription();
      toast.success("Assinatura cancelada");
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Não foi possível cancelar a assinatura"));
    } finally {
      setIsCancelling(false);
    }
  }

  const status = subscription ? STATUS_LABELS[subscription.status] : null;
  const canCancel = subscription && ["active", "trialing", "past_due"].includes(subscription.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano e cobrança</CardTitle>
        <CardDescription>Gerencie a assinatura da sua organização.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingSubscription ? (
          <Skeleton className="h-20 w-full" />
        ) : subscription ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">{subscription.plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {subscription.billingType === "recurring" ? "Cobrança mensal recorrente" : "Pagamento único"}
                {subscription.status === "trialing" && formatDate(subscription.trialUntil)
                  ? ` · teste até ${formatDate(subscription.trialUntil)}`
                  : subscription.expiresAt
                    ? ` · válido até ${formatDate(subscription.expiresAt)}`
                    : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {status && <Badge variant={status.variant}>{status.label}</Badge>}
              {canCancel && (
                <Button variant="outline" size="sm" disabled={isCancelling} onClick={handleCancel}>
                  {isCancelling && <Loader2 className="animate-spin" />}
                  Cancelar assinatura
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada para esta organização.</p>
        )}

        <div>
          <p className="mb-3 text-sm font-medium">Planos disponíveis</p>
          {isLoadingPlans ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans?.map((plan) => {
                const isCurrent = subscription?.planId === plan.id && subscription.isActive;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex flex-col rounded-lg border p-4",
                      isCurrent ? "border-brand-500 ring-1 ring-brand-500" : "border-border",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-display font-semibold">{plan.name}</p>
                      {isCurrent && <Badge variant="success">Plano atual</Badge>}
                    </div>
                    <p className="mb-3 text-2xl font-semibold tracking-tight">
                      {formatPrice(plan.price)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <div className="mb-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                        {plan.maxSessions} sessões · {plan.maxUsers} usuários · {plan.maxBots} bots
                      </div>
                    </div>
                    <Button
                      variant={isCurrent ? "secondary" : "outline"}
                      size="sm"
                      disabled={isCurrent || actionPlanId !== null || !subscription}
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      {actionPlanId === plan.id && <Loader2 className="animate-spin" />}
                      {isCurrent ? "Plano atual" : "Fazer upgrade"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
