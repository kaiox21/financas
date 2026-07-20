import { LogOut } from "lucide-react";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  email,
  iconOnly = false,
}: {
  email?: string;
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <form action={logout}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
          <LogOut className="size-4" />
        </Button>
      </form>
    );
  }

  return (
    <form action={logout} className="border-t pt-3">
      {email ? (
        <p className="text-muted-foreground truncate px-3 pb-2 text-xs">
          {email}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start"
      >
        <LogOut className="size-4" />
        Sair
      </Button>
    </form>
  );
}
