import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Enforce creator-only — shoppers shouldn't reach this surface even if
  // they manually navigate. user_type is stored in raw_user_meta_data.
  const userType =
    (user.user_metadata?.user_type as string | undefined) ?? null;
  if (userType !== "creator") {
    redirect("/login?error=not_a_creator");
  }

  const firstName =
    (user.user_metadata?.first_name as string | undefined) ?? null;

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header firstName={firstName} email={user.email ?? ""} />
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
