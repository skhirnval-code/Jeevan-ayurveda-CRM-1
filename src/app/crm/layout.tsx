import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getUser } from "@/lib/auth";
import { NAV, canPage } from "@/lib/permissions";
import { BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const nav = NAV.map((it) => "children" in it
    ? { ...it, children: it.children.filter((c) => canPage(user, c.href)) }
    : it).filter((it) => ("children" in it ? it.children!.length > 0 : canPage(user, it.href!)));
  return <Shell brand={BRAND} user={{ name: user.name, role: user.role }} nav={JSON.parse(JSON.stringify(nav))}>{children}</Shell>;
}
