import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <SidebarNav>
        <LogoutButton email={user.email} />
      </SidebarNav>

      <div className="md:pl-56">
        <header className="bg-background/95 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:hidden">
          <span className="font-heading text-base font-semibold">Finanças</span>
          <LogoutButton iconOnly />
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
