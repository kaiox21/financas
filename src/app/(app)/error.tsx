"use client"; // Error boundaries precisam ser Client Components.

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 className="font-heading text-lg font-semibold">Algo deu errado</h1>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Não foi possível carregar esta tela. Pode ter sido uma falha de conexão
          com o banco — tente de novo.
        </p>
      </div>

      <Button onClick={() => unstable_retry()}>
        <RefreshCw />
        Tentar de novo
      </Button>

      {error.digest ? (
        <p className="text-muted-foreground text-xs">
          Código do erro: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
