import { requirePage } from "@/lib/auth";
import DealersClient from "@/components/dealers/DealersClient";

export default async function DealersPage() {
  await requirePage("/crm/dealers");
  return <DealersClient />;
}
