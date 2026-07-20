"use client";

import { createElement } from "react";

import { iconFor } from "@/lib/icons";

/**
 * Renderiza o ícone de uma categoria pelo nome gravado no banco.
 *
 * Usa `createElement` em vez de `const Icon = iconFor(...)` + `<Icon />`:
 * atribuir um componente a uma variável durante o render faz o React tratá-lo
 * como um tipo novo a cada render, desmontando e remontando a subárvore.
 */
export function CategoryIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return createElement(iconFor(name), { className });
}
