import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { fetchAllUsers } from "@/services/users";
import { fetchAllEntries } from "@/services/entries";
import { formatINR } from "@/lib/format";
import { useMemo, useState } from "react";
import { Search, CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";

export const Route = createFileRoute("/admin/analysis")({
  head: () => ({ meta: [{ title: "TC Analysis · Admin" }] }),
  component: AdminAnalysisPage,
});

function formatLastLogin(iso?: string): string {
  if (!iso) return "Never logged in";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(iso: string | undefined, today: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === today;
}

type ViewMode = "day" | "month" | "year" | "range";

function getPeriodRange(
  mode: ViewMode,
  selectedDate: string,
  selectedMonth: string,
  selectedYear: string,
  rangeFrom: string,
  rangeTo: string,
) {
  if (mode === "range") {
    const from = rangeFrom || rangeTo;
    const to = rangeTo || rangeFrom;
    const fromD = new Date(`${from}T00:00:00`);
    const toD = new Date(`${to}T00:00:00`);
    const spanDays = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1);
    const prevTo = new Date(fromD);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (spanDays - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const label = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return {
      start: from,
      end: to,
      prevStart: fmt(prevFrom),
      prevEnd: fmt(prevTo),
      label: `${label(fromD)} – ${label(toD)}`,
      prevLabel: `${label(prevFrom)} – ${label(prevTo)}`,
    };
  }
  if (mode === "day") {
    const d = new Date(`${selectedDate}T00:00:00`);
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    const prevStr = prev.toISOString().slice(0, 10);
    return {
      start: selectedDate,
      end: selectedDate,
      prevStart: prevStr,
      prevEnd: prevStr,
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      prevLabel: prev.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    };
  }
  if (mode === "month") {
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevLastDay = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate();
    return {
      start: `${selectedMonth}-01`,
      end: `${selectedMonth}-${String(lastDay).padStart(2, "0")}`,
      prevStart: `${prevMonthStr}-01`,
      prevEnd: `${prevMonthStr}-${String(prevLastDay).padStart(2, "0")}`,
      label: new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      prevLabel: prevDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  }
  // year
  const y = Number(selectedYear);
  return {
    start: `${selectedYear}-01-01`,
    end: `${selectedYear}-12-31`,
    prevStart: `${y - 1}-01-01`,
    prevEnd: `${y - 1}-12-31`,
    label: selectedYear,
    prevLabel: String(y - 1),
  };
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null; // null = "new" (no baseline)
  return ((curr - prev) / prev) * 100;
}

function ChangeBadge({ curr, prev }: { curr: number; prev: number }) {
  const pct = pctChange(curr, prev);
  if (pct === null) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">New</span>;
  }
  const rounded = Math.round(pct);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const up = rounded > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-success" : "text-destructive"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{rounded}%
    </span>
  );
}

function AdminAnalysisPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));

  const period = useMemo(
    () => getPeriodRange(viewMode, selectedDate, selectedMonth, selectedYear),
    [viewMode, selectedDate, selectedMonth, selectedYear],
  );

  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: fetchAllUsers });
  const { data: entries = [] } = useQuery({
    queryKey: ["admin", "entries"],
    queryFn: fetchAllEntries,
  });

  const collectors = useMemo(
    () =>
      users.filter(
        (u) => u.role?.toLowerCase() === "tc" || u.role?.toLowerCase() === "collector",
      ),
    [users],
  );

const analysis = useMemo(() => {
    return collectors
      .map((u) => {
        const myEntries = entries.filter((e) => e.collectorId === u.id);
        const periodEntries = myEntries.filter((e) => e.date >= period.start && e.date <= period.end);
        const prevPeriodEntries = myEntries.filter((e) => e.date >= period.prevStart && e.date <= period.prevEnd);

        const periodCases = periodEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);
        const periodAmount = periodEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);
        const prevCases = prevPeriodEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);
        const prevAmount = prevPeriodEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);

        const totalCases = myEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);
        const totalAmount = myEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);

        const workedToday = myEntries.some((e) => e.date === today);
        const loggedInToday = isSameDay(u.lastLogin, today);
        const activeToday = workedToday || loggedInToday;

        return {
          user: u,
          periodCases,
          periodAmount,
          prevCases,
          prevAmount,
          totalCases,
          totalAmount,
          workedToday,
          loggedInToday,
          activeToday,
          lastLogin: u.lastLogin,
        };
      })
      .filter((row) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          row.user.name.toLowerCase().includes(s) ||
          row.user.base?.toLowerCase().includes(s) ||
          row.user.pfNo?.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => Number(b.activeToday) - Number(a.activeToday));
  }, [collectors, entries, today, search, period]);

  const periodTotals = useMemo(
    () => ({
      cases: analysis.reduce((a, r) => a + r.periodCases, 0),
      amount: analysis.reduce((a, r) => a + r.periodAmount, 0),
      prevCases: analysis.reduce((a, r) => a + r.prevCases, 0),
      prevAmount: analysis.reduce((a, r) => a + r.prevAmount, 0),
    }),
    [analysis],
  );

  const activeCount = analysis.filter((r) => r.activeToday).length;

  return (
    <AdminLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">TC Analysis</h1>
        <p className="text-sm text-muted-foreground">
          {analysis.length} collectors · {activeCount} active today
        </p>
      </div>
<div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(["day", "month", "year"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                viewMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {viewMode === "day" && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
          />
        )}
        {viewMode === "month" && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
          />
        )}
        {viewMode === "year" && (
          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-24 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
          />
        )}
      </div>

      {/* Overall comparison summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Cases — {period.label}
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-black">{periodTotals.cases}</div>
            <ChangeBadge curr={periodTotals.cases} prev={periodTotals.prevCases} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">vs {periodTotals.prevCases} in {period.prevLabel}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Fine Amount — {period.label}
          </div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-black">{formatINR(periodTotals.amount)}</div>
            <ChangeBadge curr={periodTotals.amount} prev={periodTotals.prevAmount} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">vs {formatINR(periodTotals.prevAmount)} in {period.prevLabel}</div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, base, PF no."
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="grid gap-3">
        {analysis.map((row) => (
          <div
            key={row.user.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {row.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{row.user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.user.base} · PF: {row.user.pfNo || "—"}
                  </div>
                </div>
              </div>

              {/* Active/Not Active highlight - top right */}
              {row.activeToday ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-success/15 border border-success/40 px-3 py-1.5 text-xs font-bold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active Today
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-destructive/15 border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> Not Active Today
                </span>
              )}
            </div>

           <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={`Cases (${period.label})`} value={String(row.periodCases)} change={<ChangeBadge curr={row.periodCases} prev={row.prevCases} />} />
              <Stat label={`Fine (${period.label})`} value={formatINR(row.periodAmount)} change={<ChangeBadge curr={row.periodAmount} prev={row.prevAmount} />} />
              <Stat label="Total Cases" value={String(row.totalCases)} />
              <Stat label="Total Fine" value={formatINR(row.totalAmount)} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Last login: {formatLastLogin(row.lastLogin)}</span>
              <span>·</span>
              <span>
                {row.workedToday ? "Submitted entry today" : "No entry submitted today"}
              </span>
            </div>
          </div>
        ))}

        {analysis.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No collectors match.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, change }: { label: string; value: string; change?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="text-sm font-bold">{value}</span>
        {change}
      </div>
    </div>
  );
}