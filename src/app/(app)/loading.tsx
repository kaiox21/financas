import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de carregamento das páginas do app. As páginas fazem várias queries
 * em sequência (materializar recorrentes + agregações), então um esqueleto dá
 * resposta imediata em vez de tela parada.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-48" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
