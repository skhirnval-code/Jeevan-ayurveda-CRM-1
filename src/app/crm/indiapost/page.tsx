import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { addDays, fmtDateTime, istStartOfDay, rupee } from "@/lib/dates";
import { ipConfigured } from "@/lib/indiapost";
import { PageHead, Section, Table } from "@/components/ui";
import { DocCentre, IpBarcodes, IpCheque, IpTest, IpWallet } from "@/components/ShipTools";

const DAY = 86400000;

export default async function IndiaPostPage() {
  await requirePage("/crm/indiapost");
  const base = { carrier: "INDIAPOST", deletedAt: null };
  const today = istStartOfDay();
  const now = Date.now();
  const [booked, moving, delivered, wallet, codDelivered, cheques, barcodeFree, barcodeUsed, printedNotScanned, hold, events, lastEvents] = await Promise.all([
    prisma.order.count({ where: { ...base, awb: { not: null } } }),
    prisma.order.count({ where: { ...base, awb: { not: null }, status: { notIn: ["GPO Delivered", "RTO"] } } }),
    prisma.order.count({ where: { ...base, status: "GPO Delivered" } }),
    prisma.walletEntry.findMany({ where: { carrier: "INDIAPOST" }, orderBy: { at: "desc" } }),
    prisma.order.aggregate({ where: { ...base, status: "GPO Delivered", balance: { gt: 0 } }, _sum: { balance: true }, _count: true }),
    prisma.walletEntry.aggregate({ where: { carrier: "INDIAPOST_COD" }, _sum: { amount: true } }),
    prisma.barcode.count({ where: { used: false } }),
    prisma.barcode.count({ where: { used: true } }),
    prisma.order.findMany({ where: { ...base, labelPrinted: true, shipStatus: "Portal file ka intezaar", bookedAt: { lt: today } }, select: { id: true, orderNo: true, customerName: true, balance: true, bookedAt: true } }),
    prisma.order.findMany({ where: { ...base, shipStatus: "Item Kept on Hold" }, select: { id: true, orderNo: true, customerName: true, phone: true, balance: true, awb: true } }),
    prisma.shipEvent.groupBy({ by: ["event"], where: { carrier: "INDIAPOST", at: { gte: addDays(today, -30) } }, _count: true }),
    prisma.shipEvent.findMany({ where: { carrier: "INDIAPOST" }, orderBy: { at: "desc" }, take: 25 }),
  ]);
  const balance = wallet.reduce((a, w) => a + (w.type === "DEBIT" ? -w.amount : w.amount), 0);
  const spent30 = wallet.filter((w) => w.type === "DEBIT" && w.at >= addDays(today, -30)).reduce((a, w) => a + w.amount, 0);
  const daysLeft = spent30 > 0 ? Math.floor(balance / (spent30 / 30)) : 0;

  // On-hold reason (aakhri event ka raw.reason)
  const holdEv = await prisma.shipEvent.findMany({ where: { awb: { in: hold.map((h) => h.awb!) } }, orderBy: { at: "desc" } });
  const reasonOf = (awb: string | null) => { const e = holdEv.find((x) => x.awb === awb); const raw = (e?.raw ?? {}) as Record<string, unknown>; return String(raw.reason || raw.remark || e?.location || "On Hold"); };
  const groups = new Map<string, typeof hold>();
  for (const h of hold) { const k = reasonOf(h.awb); groups.set(k, [...(groups.get(k) ?? []), h]); }

  const old = await prisma.order.findMany({
    where: { ...base, awb: { not: null }, status: { notIn: ["GPO Delivered", "RTO"] }, OR: [{ lastShipEventAt: { lt: addDays(today, -4) } }, { lastShipEventAt: null, bookedAt: { lt: addDays(today, -4) } }] },
    select: { id: true, orderNo: true, customerName: true, phone: true, shipStatus: true, balance: true, bookedAt: true, lastShipEventAt: true }, take: 200,
  });
  const costByEvent = await prisma.walletEntry.groupBy({ by: ["note"], where: { carrier: "INDIAPOST", type: "DEBIT" }, _sum: { amount: true }, _count: true });
  const host = headers().get("host") ?? "your-domain";
  const Box = ({ title, children, open = false }: { title: React.ReactNode; children: React.ReactNode; open?: boolean }) => (
    <details open={open} className="card"><summary className="cursor-pointer font-semibold">{title}</summary><div className="mt-3">{children}</div></details>
  );

  return (
    <div className="space-y-3">
      <PageHead title="India Post (DoP)" />
      <Box open title={<>📦 Shipment Operations <span className="text-sm font-normal text-slate-500">{booked} booked · {moving} chal rahe · {delivered} deliver</span></>}>
        <div className="flex flex-wrap gap-2">
          {["Item Booked", "Item Dispatched", "Taken out for delivery", "Item Kept on Hold", "Item Delivered(Addressee)", "Item Returned to Sender", "Portal file ka intezaar"].map((e) => (
            <Link key={e} className="btn btn-sm" href={`/crm/orders?post=${encodeURIComponent(e)}`}>{e}</Link>))}
        </div>
      </Box>
      <Box title={<>💰 Wallet / Advance Contract Balance <span className={`text-sm ${balance < 0 ? "text-red-600" : "text-green-600"}`}>{rupee(balance)} bacha · {daysLeft} din</span></>}>
        <IpWallet />
        <Table head={["Samay", "Type", "Amount", "Note"]} rows={wallet.slice(0, 30).map((w) => [fmtDateTime(w.at), w.type, rupee(w.amount), w.note ?? w.awb ?? ""])} />
      </Box>
      <Box title={<>🧾 COD Cheque Milaan (India Post) <span className="text-sm font-normal text-slate-500">{codDelivered._count} delivered · COD {rupee(codDelivered._sum.balance ?? 0)} · cheque mila {rupee(cheques._sum.amount ?? 0)} · baaki {rupee((codDelivered._sum.balance ?? 0) - (cheques._sum.amount ?? 0))}</span></>}>
        <IpCheque />
      </Box>
      <Box title={<>🧪 India Post API Health <span className="text-sm font-normal">{ipConfigured() ? "✅ configured" : "⚠️ creds nahi"}</span></>}><IpTest /></Box>
      <Box title={<>🏷️ Barcode / Article Manager <span className="text-sm font-normal text-slate-500">{barcodeFree} bache · {barcodeUsed} lage</span></>}><IpBarcodes /></Box>
      <Box open={printedNotScanned.length > 0} title={<>🚨 {printedNotScanned.length} parcel: receipt chhap chuki, par daakghar pahuncha hi nahi</>}>
        <Table head={["Order", "Grahak", "COD", "Book"]} rows={printedNotScanned.map((o) => [<Link key="o" className="text-blue-600" href={`/crm/orders/${o.id}`}>{o.orderNo}</Link>, o.customerName, rupee(o.balance), fmtDateTime(o.bookedAt)])} />
      </Box>
      <Box open={hold.length > 0} title={<>☎️ {hold.length} parcel &quot;On Hold&quot; - customer ko abhi phone karein</>}>
        {[...groups.entries()].map(([k, list]) => (
          <details key={k} className="mb-2 rounded-lg border p-2"><summary className="cursor-pointer">{k} · {list.length} parcel · {rupee(list.reduce((a, o) => a + o.balance, 0))}</summary>
            <Table head={["Order", "Grahak", "COD", ""]} rows={list.map((o) => [<Link key="o" className="text-blue-600" href={`/crm/orders/${o.id}`}>{o.orderNo}</Link>, `${o.customerName} · ${o.phone}`, rupee(o.balance), <a key="c" className="btn btn-sm" href={`tel:${o.phone}`}>Call</a>])} /></details>
        ))}
      </Box>
      <Box title={<>⏳ {old.length} purane parcel - inpar 4+ din se ek bhi event nahi</>}>
        <Table head={["Order", "Grahak", "Aakhri status", "COD", "Chup"]} rows={old.map((o) => [<Link key="o" className="text-blue-600" href={`/crm/orders/${o.id}`}>{o.orderNo}</Link>, `${o.customerName} · ${o.phone}`, o.shipStatus ?? "-", rupee(o.balance), `${Math.floor((now - (o.lastShipEventAt ?? o.bookedAt!).getTime()) / DAY)}d`])} />
      </Box>
      <Box title="💰 Kis scan par kitna paisa kata">
        <Table head={["Scan / Event", "Kitni baar", "Paisa"]} rows={costByEvent.map((c) => [c.note ?? "-", c._count, rupee(c._sum.amount ?? 0)])} />
      </Box>
      <Box title="🖨 Document Centre"><DocCentre carrier="INDIAPOST" /></Box>
      <Box title="⚙️ Webhook Setup (India Post portal me daalein)">
        <p className="text-sm">Booking: <code>https://{host}/api/delivery/postal/booking</code></p>
        <p className="text-sm">Events: <code>https://{host}/api/delivery/postal/events</code> · Header <code>x-api-key</code> = INGEST_TOKEN</p>
      </Box>
      <Box title={<>India Post Webhook Events <span className="text-sm font-normal text-slate-500">{lastEvents.length} haal ke</span></>}>
        <Table head={["Samay", "Article", "Event", "Office"]} rows={lastEvents.map((e) => [fmtDateTime(e.at), e.awb, e.event, e.location ?? ""])} />
        <div className="mt-2 flex flex-wrap gap-2 text-xs">{events.map((e) => <span key={e.event} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-900">{e.event}: {e._count}</span>)}</div>
      </Box>
    </div>
  );
}
