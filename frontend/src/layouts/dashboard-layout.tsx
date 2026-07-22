import type { ReactNode } from "react";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <DashboardNavbar />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
