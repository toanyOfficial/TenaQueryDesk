import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getSession } from "@/lib/server/auth/session";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!(await getSession())) redirect("/login");
  return <AdminDashboard />;
}
