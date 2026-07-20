"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteCreditCard, setCreditCardArchived } from "@/actions/credit-cards";
import { CardDialog, useCardDialog } from "@/components/accounts/card-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CreditCard } from "@/types/database";

export function CardsPanel({ cards }: { cards: CreditCard[] }) {
  const dialog = useCardDialog();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = cards.filter((card) => !card.archived);
  const archived = cards.filter((card) => card.archived);

  function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        toast.error("Algo deu errado. Tente de novo.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={dialog.openNew}>
          <Plus />
          Novo cartão
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum cartão ainda. Sem cartão, lançamentos no crédito ficam indisponíveis.
          </p>
          <Button onClick={dialog.openNew}>
            <Plus />
            Novo cartão
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...archived].map((card) => (
            <li
              key={card.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-4",
                card.archived && "opacity-60",
                busyId === card.id && pending && "animate-pulse",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {card.name}
                  {card.archived ? (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      arquivado
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  Limite {formatBRL(card.limit_cents)} · fecha dia {card.closing_day} ·
                  vence dia {card.due_day}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="Ações do cartão" />
                  }
                >
                  <MoreVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => dialog.openEdit(card)}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      run(card.id, async () => {
                        await setCreditCardArchived(card.id, !card.archived);
                        toast.success(
                          card.archived ? "Cartão reativado." : "Cartão arquivado.",
                        );
                      })
                    }
                  >
                    {card.archived ? <ArchiveRestore /> : <Archive />}
                    {card.archived ? "Reativar" : "Arquivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      run(card.id, async () => {
                        const result = await deleteCreditCard(card.id);
                        if (result.error) toast.error(result.error);
                        else toast.success("Cartão excluído.");
                      })
                    }
                  >
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <CardDialog
        key={dialog.card?.id ?? "new"}
        card={dialog.card}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
      />
    </div>
  );
}
