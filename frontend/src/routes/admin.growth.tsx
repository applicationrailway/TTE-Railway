import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { fetchAllEntries } from "@/services/entries";
import { fetchAllComplaints } from "@/services/complaints";
import { fetchAllUsers } from "@/services/users";
import { formatINR, formatDate } from "@/lib/format";
import { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, IndianRupee, ClipboardList,
  MessageSquareWarning, Users, Train, Award, Landmark,
  CheckCircle2, Clock, Calendar,
} from "lucide-react";

export const Route = createFileRoute("/admin/growth")({
  head: () => ({ meta: [{ title: "Admin Analysis · Admin" }] }),
  component: AdminGrowthPage,
});

type RangeDays = 7 | 14 | 30;

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
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

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

// Build a smoothed SVG path (cubic bezier through midpoints) for an area/line chart
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

// Cycling color palette for multi-segment charts (donut, category bars)
const PALETTE = [
  { stroke: "stroke-primary", bg: "bg-primary", text: "text-primary" },
  { stroke: "stroke-warning", bg: "bg-warning", text: "text-warning-foreground" },
  { stroke: "stroke-success", bg: "bg-success", text: "text-success" },
  { stroke: "stroke-destructive", bg: "bg-destructive", text: "text-destructive" },
  { stroke: "stroke-accent-foreground", bg: "bg-accent-foreground", text: "text-accent-foreground" },
  { stroke: "stroke-muted-foreground", bg: "bg-muted-foreground", text: "text-muted-foreground" },
];

function AdminGrowthPage() {
  const { data: entries = [] } = useQuery({
    queryKey: ["admin", "entries"],
    queryFn: fetchAllEntries,
  });
  const { data: complaints = [] } = useQuery({
    queryKey: ["admin", "complaints"],
    queryFn: fetchAllComplaints,
  });
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: fetchAllUsers });

 const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(thisMonth);
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);

  const period = useMemo(
    () => getPeriodRange(viewMode, selectedDate, selectedMonth, selectedYear, rangeFrom, rangeTo),
    [viewMode, selectedDate, selectedMonth, selectedYear, rangeFrom, rangeTo],
  );

  const submitted = useMemo(() => entries.filter((e) => e.status === "submitted"), [entries]);

  const collectors = useMemo(
    () =>
      users.filter(
        (u) => u.role?.toLowerCase() === "tc" || u.role?.toLowerCase() === "collector",
      ),
    [users],
  );

  // Date-range boundary for the selected filter (7D / 14D / 30D)
  const rangeEntries = useMemo(
    () => submitted.filter((e) => e.date >= period.start && e.date <= period.end),
    [submitted, period],
  
  );

  // Quick summary totals for the selected range
  const rangeSummary = useMemo(() => {
    const revenue = rangeEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);
    const cases = rangeEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);
    return { revenue, cases };
  }, [rangeEntries]);

const stats = useMemo(() => {
    const thisMonthEntries = submitted.filter((e) => e.date >= period.start && e.date <= period.end);
    const lastMonthEntries = submitted.filter((e) => e.date >= period.prevStart && e.date <= period.prevEnd);

    const revenueThis = thisMonthEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);
    const revenueLast = lastMonthEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);
    const casesThis = thisMonthEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);
    const casesLast = lastMonthEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);

    const resolvedCount = complaints.filter(
      (c) => c.status === "Resolved" || c.status === "Closed",
    ).length;
    const resolutionRate = complaints.length > 0 ? (resolvedCount / complaints.length) * 100 : 0;

    const activeTodayIds = new Set(
      submitted.filter((e) => e.date === today).map((e) => e.collectorId),
    );
    const activeRate = collectors.length > 0 ? (activeTodayIds.size / collectors.length) * 100 : 0;

    return {
      revenueThis, revenueLast, revenueGrowth: pctChange(revenueThis, revenueLast),
      casesThis, casesLast, casesGrowth: pctChange(casesThis, casesLast),
      resolutionRate,
      totalCollectors: collectors.length,
      activeToday: activeTodayIds.size,
      activeRate,
      resolvedCount,
      openCount: complaints.length - resolvedCount,
    };
}, [submitted, complaints, collectors, period, today]);
  // Revenue trend chart data — respects the selected range filter
  // Revenue trend chart data — day-wise within a month, or month-wise within a year
  const dailyTrend = useMemo(() => {
    if (viewMode === "year") {
      const y = Number(selectedYear);
      const months: { date: string; label: string; amount: number }[] = [];
      for (let m = 0; m < 12; m++) {
        const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
        const amount = submitted
          .filter((e) => monthKey(e.date) === monthStr)
          .reduce((a, e) => a + (e.totalAmount ?? 0), 0);
        months.push({
          date: monthStr,
          label: new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short" }),
          amount,
        });
      }
      return months;
    }
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const days: { date: string; label: string; amount: number }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, "0")}`;
      const amount = submitted
        .filter((e) => e.date === dateStr)
        .reduce((a, e) => a + (e.totalAmount ?? 0), 0);
      days.push({ date: dateStr, label: String(d), amount });
    }
    return days;
  }, [submitted, viewMode, selectedMonth, selectedYear]);

  const maxDaily = Math.max(...dailyTrend.map((d) => d.amount), 1);

  const CHART_W = 600;
  const CHART_H = 200;
  const chartPoints = dailyTrend.map((d, i) => ({
    x: (i / Math.max(dailyTrend.length - 1, 1)) * CHART_W,
    y: CHART_H - (d.amount / maxDaily) * (CHART_H - 20) - 10,
  }));
  const linePath = buildSmoothPath(chartPoints);
  const areaPath = linePath + ` L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`;

  // Base-wise performance (this month) — bar view
  const baseWise = useMemo(() => {
    const map: Record<string, { cases: number; amount: number }> = {};
    submitted
      .filter((e) => monthKey(e.date) === thisMonth)
      .forEach((e) => {
        const base = e.collectorBase || "N/A";
        if (!map[base]) map[base] = { cases: 0, amount: 0 };
        map[base].cases += e.totalCases ?? 0;
        map[base].amount += e.totalAmount ?? 0;
      });
    return Object.entries(map)
      .map(([base, v]) => ({ base, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [submitted, thisMonth]);

  const maxBaseAmount = Math.max(...baseWise.map((b) => b.amount), 1);

  // Revenue share by base — donut view (uses selected range)
  const baseShareDonut = useMemo(() => {
    const map: Record<string, number> = {};
    rangeEntries.forEach((e) => {
      const base = e.collectorBase || "N/A";
      map[base] = (map[base] || 0) + (e.totalAmount ?? 0);
    });
    const total = Object.values(map).reduce((a, v) => a + v, 0);
    return Object.entries(map)
      .map(([base, amount], i) => ({
        base,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
        color: PALETTE[i % PALETTE.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [rangeEntries]);

  // Top collectors by revenue (uses selected range)
  const topCollectors = useMemo(() => {
    const map: Record<string, { name: string; base: string; amount: number }> = {};
    rangeEntries.forEach((e) => {
      const id = e.collectorId;
      if (!map[id]) {
        map[id] = { name: e.collectorName || "Unknown", base: e.collectorBase || "N/A", amount: 0 };
      }
      map[id].amount += e.totalAmount ?? 0;
    });
    return Object.values(map)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [rangeEntries]);

  const maxCollectorAmount = Math.max(...topCollectors.map((c) => c.amount), 1);

  // Complaints by category
  const complaintsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    complaints.forEach((c) => {
      const cat = c.category || "Other";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .map(([category, count], i) => ({ category, count, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.count - a.count);
  }, [complaints]);

  const maxCategoryCount = Math.max(...complaintsByCategory.map((c) => c.count), 1);

  // Recent activity — latest 6 submitted entries
  const recentActivity = useMemo(() => {
    return [...submitted]
      .sort((a, b) => (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0))
      .slice(0, 6);
  }, [submitted]);

  // Donut geometry
  const DONUT_SIZE = 160;
  const DONUT_STROKE = 26;
  const donutR = (DONUT_SIZE - DONUT_STROKE) / 2;
  const donutC = 2 * Math.PI * donutR;
  let donutCumulative = 0;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Analysis</h1>
       <p className="text-sm text-muted-foreground">
          Growth &amp; performance overview — {period.label} vs {period.prevLabel}.
        </p>
      </div>

      {/* ── Period selector (Day / Month / Year) for KPI comparison ── */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(["day", "month", "year", "range"] as const).map((m) => (
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
        {viewMode === "range" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
            />
          </div>
        )}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Comparing {period.label} vs {period.prevLabel}
        </span>
      </section>

      {/* ── Filter range + quick summary cards ── */}
      {/* ── Quick summary cards (period-based) ── */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-primary-soft p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-primary">
            Total Revenue
            <IndianRupee className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold text-primary">{formatINR(rangeSummary.revenue)}</div>
        </div>

        <div className="rounded-2xl border border-border bg-success/10 p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-success">
            Total Cases
            <ClipboardList className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold text-success">{rangeSummary.cases}</div>
        </div>

        <div className="rounded-2xl border border-border bg-warning/10 p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-warning-foreground">
            Total Collectors
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl font-bold text-warning-foreground">{stats.totalCollectors}</div>
        </div>
      </section>

      {/* ── KPI Cards with circular progress rings ── */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RingKpiCard
          icon={IndianRupee}
          label={`Revenue — ${period.label}`}
          value={formatINR(stats.revenueThis)}
          growth={stats.revenueGrowth}
        />
        <RingKpiCard
          icon={ClipboardList}
          label={`Cases — ${period.label}`}
          value={String(stats.casesThis)}
          growth={stats.casesGrowth}
        />
        <RingKpiCard
          icon={MessageSquareWarning}
          label="Complaint resolution"
          value={`${stats.resolutionRate.toFixed(0)}%`}
          ringPct={stats.resolutionRate}
        />
        <RingKpiCard
          icon={Users}
          label="Active TCs today"
          value={`${stats.activeToday} / ${stats.totalCollectors}`}
          ringPct={stats.activeRate}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Smooth area chart — revenue trend, respects filter range */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
         <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Revenue Trend — {period.label}
          </h2>
          <div className="relative">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full"
              style={{ height: 200 }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1={0} x2={CHART_W}
                  y1={CHART_H * f} y2={CHART_H * f}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ))}
              <path d={areaPath} fill="url(#revenueGradient)" stroke="none" />
              <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" />
              {chartPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--color-primary)" />
              ))}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{dailyTrend[0]?.label}</span>
              <span>{dailyTrend[Math.floor(dailyTrend.length / 2)]?.label}</span>
              <span>{dailyTrend[dailyTrend.length - 1]?.label}</span>
            </div>
          </div>
        </div>

        {/* Base-wise performance — bar view */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Base-wise Revenue — This Month
          </h2>
          {baseWise.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <div className="space-y-3">
              {baseWise.map((b) => (
                <div key={b.base}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">{b.base}</span>
                    <span className="text-muted-foreground">
                      {b.cases} cases · {formatINR(b.amount)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(b.amount / maxBaseAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity table */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No submissions yet.</div>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                      <Train className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {e.collectorName || "Unknown TC"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        Train {e.trainNumber} · {formatDate(e.date)}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-primary">{formatINR(e.totalAmount ?? 0)}</div>
                    <div className="text-[10px] text-muted-foreground">{e.totalCases ?? 0} cases</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── NEW: Top Collectors by Revenue leaderboard ── */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Award className="h-4 w-4" /> Top Collectors by Revenue
          </h2>
          {topCollectors.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No data in this range.</div>
          ) : (
            <div className="space-y-3">
              {topCollectors.map((c, i) => (
                <div key={c.name + i}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {i + 1}. {c.name}{" "}
                      <span className="font-normal text-muted-foreground">{c.base}</span>
                    </span>
                    <span className="font-bold text-primary">{formatINR(c.amount)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(c.amount / maxCollectorAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

       {/* ── NEW: Revenue Share by Base — stacked layered bar ── */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Landmark className="h-4 w-4" /> Revenue Share by Base
          </h2>
          {baseShareDonut.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No data in this range.</div>
          ) : (
            <>
              {/* Single stacked bar — each base is a colored layer/segment */}
              <div className="flex h-8 w-full overflow-hidden rounded-xl">
                {baseShareDonut.map((seg) => (
                  <div
                    key={seg.base}
                    className={`${seg.color.bg} flex items-center justify-center transition-all`}
                    style={{ width: `${Math.max(seg.pct, 4)}%` }}
                    title={`${seg.base}: ${seg.pct.toFixed(0)}%`}
                  >
                    {seg.pct >= 12 && (
                      <span className="text-[10px] font-bold text-white">{seg.pct.toFixed(0)}%</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend below the bar */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {baseShareDonut.map((seg) => (
                  <div key={seg.base} className="flex items-center gap-1.5 text-xs">
                    <span className={`h-2.5 w-2.5 rounded-full ${seg.color.bg}`} />
                    <span className="font-semibold">{seg.base}</span>
                    <span className="text-muted-foreground">
                      {formatINR(seg.amount)} ({seg.pct.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── NEW: Complaints by Category — bar chart ── */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquareWarning className="h-4 w-4" /> Complaints by Category
          </h2>
          {complaintsByCategory.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No complaints yet.</div>
          ) : (
            <div className="flex items-end gap-3" style={{ height: 140 }}>
              {complaintsByCategory.map((c) => (
                <div key={c.category} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-xs font-bold">{c.count}</span>
                  <div
                    className={`w-full rounded-t-lg ${c.color.bg}`}
                    style={{ height: `${Math.max((c.count / maxCategoryCount) * 100, 6)}%` }}
                  />
                  <span className="max-w-full truncate text-[10px] text-muted-foreground">{c.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── NEW: Complaint Resolution Performance ── */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Complaint Resolution Performance
          </h2>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-xl bg-success/10 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-success">{stats.resolvedCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-success">Closed</div>
            </div>
            <div className="flex-1 rounded-xl bg-warning/10 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-warning-foreground">{stats.openCount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-warning-foreground">Open</div>
            </div>
            <div className="flex items-center gap-2 px-4 text-center sm:min-w-[110px] sm:flex-col sm:justify-center sm:gap-0">
              <Clock className="hidden h-4 w-4 text-muted-foreground sm:block" />
              <div className="text-2xl font-bold text-primary">{stats.resolutionRate.toFixed(0)}%</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rate</div>
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${stats.resolutionRate}%` }}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function CircularProgress({ pct, size = 44, stroke = 5 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="stroke-muted" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        className="stroke-primary transition-all"
      />
    </svg>
  );
}

function RingKpiCard({
  icon: Icon,
  label,
  value,
  growth,
  ringPct,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  growth?: number | null;
  ringPct?: number;
}) {
  const showGrowthRing = growth !== undefined && growth !== null;
  const pctForRing = ringPct !== undefined ? ringPct : Math.min(Math.abs(growth ?? 0), 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold">{value}</div>
          {showGrowthRing && (
            <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
              (growth ?? 0) >= 0 ? "text-success" : "text-destructive"
            }`}>
              {(growth ?? 0) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(growth ?? 0).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="relative shrink-0">
          <CircularProgress pct={pctForRing} />
          <div className="absolute inset-0 grid place-items-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}