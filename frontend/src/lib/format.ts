export function formatINR(n: number) {
  return "₹" + (n ?? 0).toLocaleString("en-IN");
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}