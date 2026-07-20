"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatAmount, parseAmountToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Input de dinheiro: aceita "1234", "1234,56" ou "1.234,56" e normaliza
 * para "1.234,56" ao sair do campo. O valor cru vai no form; quem converte
 * para centavos é o Zod na server action.
 */
export function MoneyInput({
  defaultCents,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "defaultValue" | "type"> & {
  defaultCents?: number;
}) {
  const [value, setValue] = useState(
    defaultCents === undefined ? "" : formatAmount(defaultCents),
  );

  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        R$
      </span>
      <Input
        {...props}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className={cn("pl-9 text-right tabular-nums", className)}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={(event) => {
          const cents = parseAmountToCents(event.target.value);
          if (cents !== null) setValue(formatAmount(cents));
        }}
      />
    </div>
  );
}
