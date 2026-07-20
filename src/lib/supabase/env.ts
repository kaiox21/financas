/**
 * Leitura centralizada das env vars do Supabase.
 * Aceita tanto o nome novo (publishable key) quanto o legado (anon key).
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copie .env.example para .env.local.",
    );
  }

  return { url, key };
}
