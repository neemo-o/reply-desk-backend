import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/lib/api-errors";
import { AuthLayout } from "@/layouts/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth-service";
import { useAuth } from "@/contexts/auth-provider";

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .length(6, "O código tem 6 dígitos")
    .regex(/^\d{6}$/, "O código deve conter apenas números"),
});

type CodeFormValues = z.infer<typeof codeSchema>;

export function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CodeFormValues>({ resolver: zodResolver(codeSchema) });

  // Conta regressiva do cooldown de reenvio (1 por segundo).
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Já verificado (ex.: usuário recarregou a página depois de confirmar) — segue em frente.
  if (user?.emailVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(values: CodeFormValues) {
    setIsSubmitting(true);
    try {
      await authService.verifyEmail(values.code);
      await refreshUser();
      toast.success("E-mail confirmado com sucesso");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = extractApiErrorMessage(error, "Código inválido ou expirado");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    try {
      const { retryAfterSeconds } = await authService.resendVerification();
      setCooldown(retryAfterSeconds);
      toast.success("Reenviamos o código para o seu e-mail");
    } catch (error) {
      const message = extractApiErrorMessage(error, "Não foi possível reenviar o código agora");
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthLayout
      title="Confirme seu e-mail"
      subtitle={
        user?.email
          ? `Enviamos um código de 6 dígitos para ${user.email}`
          : "Enviamos um código de 6 dígitos para o seu e-mail"
      }
      footer={
        <>
          Não recebeu?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            className="font-medium text-brand-500 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Código de verificação</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="text-center text-2xl tracking-[0.5em]"
            aria-invalid={Boolean(errors.code)}
            {...register("code")}
          />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Confirmar e-mail
        </Button>
      </form>
    </AuthLayout>
  );
}
