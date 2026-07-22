import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { supabaseEnv } from "./env";

/**
 * Client para Server Components, Server Actions e Route Handlers.
 * Sempre criar um novo por request — nunca guardar em variável de módulo.
 */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: o refresh de sessão já é feito
          // no proxy, então dá para ignorar com segurança.
        }
      },
    },
  });
}

/**
 * Claims do usuário autenticado, ou `null`.
 *
 * Usa `getClaims()`, que verifica o JWT localmente (WebCrypto) quando o projeto
 * usa chaves de assinatura assimétricas — o padrão do Supabase. Sem round-trip
 * ao servidor de auth a cada navegação, ao contrário de `getUser()`. Tokens
 * perto de expirar ainda são renovados antes da validação.
 */
export async function getAuthClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}
