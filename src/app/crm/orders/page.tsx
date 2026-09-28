import { Suspense } from "react";
import { requirePage } from "@/lib/auth";
import OrdersClient from "@/components/orders/OrdersClient";

export default async function OrdersPage() {
  await requirePage("/crm/orders");
  return <Suspense fallback={<div>Load ho raha hai…</div>}><OrdersClient /></Suspense>;
}
