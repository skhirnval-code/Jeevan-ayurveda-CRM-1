"use client";
import { useRouter } from "next/navigation";

export default function WorkModeSelect({ userId, mode }: { userId: number; mode: string }) {
  const r = useRouter();
  return (
    <select className="input !w-auto !py-1" defaultValue={mode} onChange={async (e) => {
      await fetch("/api/users/workmode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, mode: e.target.value }) });
      r.refresh();
    }}>
      <option value="OFFICE">🏢 Office</option><option value="WFH">🏠 Ghar se</option>
    </select>
  );
}
