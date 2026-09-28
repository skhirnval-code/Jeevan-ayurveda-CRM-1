import { requirePage } from "@/lib/auth";
import OrderForm from "@/components/orders/OrderForm";

export default async function NewOrder() {
  await requirePage("/crm/orders");
  return <OrderForm />;
}
