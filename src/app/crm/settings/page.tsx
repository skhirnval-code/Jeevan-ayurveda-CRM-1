import { requirePage } from "@/lib/auth";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  await requirePage("/crm/settings");
  return <SettingsClient />;
}
