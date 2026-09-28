import { requirePage } from "@/lib/auth";
import InvoicesClient from "@/components/dealers/InvoicesClient";

export default async function InvoicesPage() {
  await requirePage("/crm/dealers/invoices");
  return <InvoicesClient />;
}
