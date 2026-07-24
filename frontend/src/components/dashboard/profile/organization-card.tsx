import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantMembers, useTenantSummary } from "@/hooks/use-tenant";
import { useAuth } from "@/contexts/auth-provider";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  agent: "Atendente",
};

export function OrganizationCard() {
  const { tenant } = useAuth();
  const { data: summary, isLoading: isLoadingSummary } = useTenantSummary();
  const { data: members, isLoading: isLoadingMembers } = useTenantMembers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organização</CardTitle>
        <CardDescription>Dados do workspace e das pessoas com acesso a ele.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingSummary ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">{summary?.name}</p>
              <p className="text-sm text-muted-foreground">/{summary?.slug}</p>
            </div>
            <Badge variant={tenant?.role === "owner" ? "success" : "secondary"}>
              {tenant ? ROLE_LABELS[tenant.role] ?? tenant.role : "—"}
            </Badge>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Membros</p>
          {isLoadingMembers ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {members?.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {ROLE_LABELS[member.role.name] ?? member.role.name}
                  </Badge>
                </div>
              ))}
              {members?.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum membro encontrado.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
