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

/** Usuário autenticado ou `null`. Valida o token no servidor do Supabase. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
