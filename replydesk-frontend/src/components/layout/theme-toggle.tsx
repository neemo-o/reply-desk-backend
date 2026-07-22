import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Evita mismatch entre o ícone renderizado no server/first-paint e o cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      onClick={toggle}
      className="text-muted-foreground hover:text-foreground"
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
