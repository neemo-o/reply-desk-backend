import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Visão geral", end: true },
  { to: "/dashboard/profile", label: "Perfil", end: false },
];

export function DashboardTabs() {
  return (
    <nav className="mb-8 inline-flex h-10 items-center gap-1 rounded-lg bg-secondary p-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
