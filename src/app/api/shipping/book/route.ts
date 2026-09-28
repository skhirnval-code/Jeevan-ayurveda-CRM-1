import { requireApi } from "@/lib/auth";
import { bookIndiaPost, bookShiprocket } from "@/lib/shipping";
import { handle, num, ok } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const b = await req.json();
  if (b.carrier === "INDIAPOST") {
    const me = await requireApi("ip.book");
    return ok(await bookIndiaPost(num(b.orderId), me, b.articleNo || undefined));
  }
  const me = await requireApi("sr.book");
  return ok(await bookShiprocket(num(b.orderId), me, { courierId: b.courierId ? num(b.courierId) : undefined, weight: b.weight ? num(b.weight) : undefined }));
});
