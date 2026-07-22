"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Três estados explícitos (claro / escuro / sistema) num segmento, em vez de um
// botão que alterna sem dizer para onde. O usuário controla o tema, então mostra
// as opções que ele controla.
const OPTIONS = [
  { value: "light", label: "Tema claro", icon: Sun },
  { value: "dark", label: "Tema escuro", icon: Moon },
  { value: "system", label: "Tema do sistema", icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // O tema resolvido só existe no cliente; até montar, renderiza o trilho vazio
  // para não piscar o estado errado nem quebrar a hidratação.
  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn(
        "bg-muted flex items-center gap-0.5 rounded-lg p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Tema"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

// Variante compacta para a barra superior do mobile: um botão que cicla claro →
// escuro → sistema, com o ícone do estado atual.
export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme ?? "system") : "system";
  const next =
    current === "light" ? "dark" : current === "dark" ? "system" : "light";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      onClick={() => setTheme(next)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
