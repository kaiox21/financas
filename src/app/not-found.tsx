import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="font-heading mt-1 text-xl font-semibold">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          O endereço não existe ou foi movido.
        </p>
      </div>
      <Button render={<Link href="/" />}>Voltar ao início</Button>
    </main>
  );
}
