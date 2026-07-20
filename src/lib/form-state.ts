/**
 * Contrato entre server actions e formulários (`useActionState`).
 * Vive fora de `actions/` de propósito: componentes client importam daqui,
 * e importar de um módulo "use server" arrastaria `next/headers` para o bundle.
 */

export type FormState = { error: string | null; ok: boolean };

export const emptyState: FormState = { error: null, ok: false };

export function failure(error: string): FormState {
  return { error, ok: false };
}

export const success: FormState = { error: null, ok: true };
