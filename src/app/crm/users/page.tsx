import { requirePage } from "@/lib/auth";
import UsersClient from "@/components/UsersClient";

export default async function UsersPage() {
  const me = await requirePage("/crm/users");
  return <UsersClient isSuper={me.role === "SUPER_ADMIN"} />;
}
