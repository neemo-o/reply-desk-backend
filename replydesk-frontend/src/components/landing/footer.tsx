import { Logo } from "@/components/layout/logo";

const links = [
  { label: "Benefícios", href: "#beneficios" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Termos de uso", href: "#" },
  { label: "Privacidade", href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between">
        <Logo className="h-6" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {links.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ReplyDesk. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
