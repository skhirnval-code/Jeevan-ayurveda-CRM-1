"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useMeta";

type C = { id: number; name: string; rate: number; etd: string; rating: number };

export default function BookModal({ orderId, orderNo, carrier, onClose, onDone }: {
  orderId: number; orderNo: string; carrier: "SHIPROCKET" | "INDIAPOST"; onClose: () => void; onDone: () => void;
}) {
  const [couriers, setCouriers] = useState<C[]>([]);
  const [rec, setRec] = useState<number | null>(null);
  const [courierId, setCourierId] = useState("");
  const [weight, setWeight] = useState("0.5");
  const [article, setArticle] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (carrier !== "SHIPROCKET") return;
    api<{ couriers: C[]; recommended: number }>(`/api/shipping/serviceability?orderId=${orderId}`)
      .then((r) => { setCouriers(r.couriers); setRec(r.recommended); })
      .catch((e) => setMsg(e.message));
  }, [orderId, carrier]);

  async function book() {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ awb?: string }>("/api/shipping/book", "POST", { orderId, carrier, courierId: courierId || undefined, weight, articleNo: article || undefined });
      setMsg(`Book ho gaya ✓ AWB: ${r.awb ?? "-"}`);
      setTimeout(onDone, 900);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-lg">
        <div className="mb-3 flex justify-between"><h3 className="font-bold">{carrier === "SHIPROCKET" ? "📦 Book with Shiprocket" : "📮 India Post booking"} — {orderNo}</h3><button onClick={onClose}>✕</button></div>
        {carrier === "SHIPROCKET" ? (
          <>
            <label className="label">Courier (khaali = Shiprocket recommended)</label>
            <select className="input mb-2" value={courierId} onChange={(e) => setCourierId(e.target.value)}>
              <option value="">Auto / Recommended</option>
              {couriers.map((c) => <option key={c.id} value={c.id}>{c.id === rec ? "⭐ " : ""}{c.name} — ₹{c.rate} · {c.etd} · ★{c.rating}</option>)}
            </select>
            <label className="label">Weight (kg)</label>
            <input className="input mb-3" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </>
        ) : (
          <>
            <label className="label">Article number (khaali = Barcode Manager se agla)</label>
            <input className="input mb-3" placeholder="EY123456789IN" value={article} onChange={(e) => setArticle(e.target.value.toUpperCase())} />
          </>
        )}
        {msg && <p className="mb-2 text-sm">{msg}</p>}
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={book}>{busy ? "..." : "Book"}</button></div>
      </div>
    </div>
  );
}
