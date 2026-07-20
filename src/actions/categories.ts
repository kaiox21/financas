"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CATEGORY_ICONS, DEFAULT_COLOR, DEFAULT_ICON } from "@/lib/icons";
import { createClient } from "@/lib/supabase/server";

import {
  failure,
  firstIssue,
  requireUserId,
  success,
  type FormState,
} from "./utils";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(40, "Nome muito longo"),
  type: z.enum(["income", "expense"]),
  icon: z
    .string()
    .refine((value) => value in CATEGORY_ICONS, "Ícone inválido")
    .default(DEFAULT_ICON),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .default(DEFAULT_COLOR),
  parent_id: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable(),
});

function revalidate() {
  revalidatePath("/categorias");
  revalidatePath("/transacoes");
  revalidatePath("/");
}

export async function saveCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon") ?? DEFAULT_ICON,
    color: formData.get("color") ?? DEFAULT_COLOR,
    parent_id: formData.get("parent_id") ?? "",
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const supabase = await createClient();
  const id = formData.get("id");

  if (typeof id === "string" && id) {
    if (parsed.data.parent_id === id) {
      return failure("Uma categoria não pode ser subcategoria dela mesma.");
    }
    const { error } = await supabase.from("categories").update(parsed.data).eq("id", id);
    if (error) return failure(friendlyError(error.message));
  } else {
    const { error } = await supabase
      .from("categories")
      .insert({ ...parsed.data, user_id: await requireUserId() });
    if (error) return failure(friendlyError(error.message));
  }

  revalidate();
  return success;
}

export async function deleteCategory(id: string): Promise<FormState> {
  const supabase = await createClient();

  // Transações e subcategorias não somem junto: category_id é ON DELETE SET NULL
  // nas transações, mas subcategoria é ON DELETE CASCADE — então avisamos antes.
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);

  if (count && count > 0) {
    return failure(
      `Esta categoria tem ${count} subcategoria(s). Exclua ou mova as subcategorias antes.`,
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir a categoria.");

  revalidate();
  return success;
}

/** As mensagens do Postgres vazam nomes de constraint; aqui viram português. */
function friendlyError(message: string): string {
  if (message.includes("categories_unique_name_idx")) {
    return "Já existe uma categoria com esse nome nesse nível.";
  }
  if (message.includes("máximo 2")) {
    return "Subcategoria só pode ter um nível.";
  }
  if (message.includes("mesmo tipo")) {
    return "A subcategoria precisa ser do mesmo tipo da categoria pai.";
  }
  return "Não foi possível salvar a categoria.";
}
