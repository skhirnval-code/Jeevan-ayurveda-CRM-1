import { requirePage } from "@/lib/auth";
import OrderForm from "@/components/orders/OrderForm";

export default async function EditOrder({ params }: { params: { id: string } }) {
  await requirePage("/crm/orders");
  return <OrderForm id={+params.id} />;
}
