import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { fetchAllEntries } from "@/services/entries";
import { fetchAllComplaints } from "@/services/complaints";
import { fetchAllUsers } from "@/services/users";
import { formatINR, formatDate } from "@/lib/format";
import {
  Users,
  ClipboardList,
  IndianRupee,
  MessageSquareWarning,
  CheckCircle2,
  Briefcase,
  ArrowRight,
  Search,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard · TC System" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: entries = [] } = useQuery({
    queryKey: ["admin", "entries"],
    queryFn: fetchAllEntries,
  });
  const { data: complaints = [] } = useQuery({
    queryKey: ["admin", "complaints"],
    queryFn: fetchAllComplaints,
  });
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: fetchAllUsers });

  const stats = useMemo(() => {
    const collectors = users.filter(
      (u) => u.role?.toLowerCase() === "tc" || u.role?.toLowerCase() === "collector",
    ).length;
    const todayEntries = entries.filter((e) => e.date === today);
    const revenue = todayEntries.reduce((a, e) => a + (e.totalAmount ?? 0), 0);
    const cases = todayEntries.reduce((a, e) => a + (e.totalCases ?? 0), 0);
    const open = complaints.filter((c) => c.status !== "Resolved" && c.status !== "Closed").length;
    const closed = complaints.filter(
      (c) => c.status === "Resolved" || c.status === "Closed",
    ).length;
    return { collectors, todayEntries, revenue, cases, open, closed };
  }, [users, entries, complaints, today]);

  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { users: [], entries: [], complaints: [] };

    const matchedUsers = users
      .filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q) ||
          u.id?.toLowerCase().includes(q),
      )
      .slice(0, 5);

    const matchedEntries = entries
      .filter(
        (e) =>
          String(e.trainNumber ?? "").toLowerCase().includes(q) ||
          e.collectorName?.toLowerCase().includes(q) ||
          users.find((u) => u.id === e.collectorId)?.name?.toLowerCase().includes(q),
      )
      .slice(0, 5);

    const matchedComplaints = complaints
      .filter(
        (c) =>
          String(c.number ?? "").toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          String(c.train ?? "").toLowerCase().includes(q) ||
          c.status?.toLowerCase().includes(q) ||
          c.collectorName?.toLowerCase().includes(q),
      )
      .slice(0, 5);

    return { users: matchedUsers, entries: matchedEntries, complaints: matchedComplaints };
  }, [query, users, entries, complaints]);

  const hasResults =
    searchResults.users.length > 0 ||
    searchResults.entries.length > 0 ||
    searchResults.complaints.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function clearSearch() {
    setQuery("");
    setShowResults(false);
  }

  const recentComplaints = complaints.slice(0, 5);
  const recentEntries = entries.slice(0, 5);

  const cards = [
    { label: "Total Collectors", value: stats.collectors, icon: Users, tone: "primary" as const },
    {
      label: "Entries Today",
      value: stats.todayEntries.length,
      icon: ClipboardList,
      tone: "soft" as const,
    },
    {
      label: "Revenue Today",
      value: formatINR(stats.revenue),
      icon: IndianRupee,
      tone: "primary" as const,
    },
    {
      label: "Open Complaints",
      value: stats.open,
      icon: MessageSquareWarning,
      tone: "warning" as const,
    },
    {
      label: "Closed Complaints",
      value: stats.closed,
      icon: CheckCircle2,
      tone: "success" as const,
    },
    { label: "Total Cases Today", value: stats.cases, icon: Briefcase, tone: "soft" as const },
  ];

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of today's operations across all bases.
          </p>
        </div>

        <div ref={searchRef} className="relative w-full md:w-80">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => query && setShowResults(true)}
              placeholder="Search TC, train, complaint..."
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-sm outline-none ring-primary/30 focus:ring-2"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {showResults && query && (
            <div className="absolute right-0 z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-card">
              {!hasResults && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No results found.
                </div>
              )}

              {searchResults.users.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                    Users
                  </div>
                  {searchResults.users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        navigate({ to: "/admin/users" });
                        setShowResults(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">{u.name}</span>
                      <span className="chip text-[10px]">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.entries.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                    Entries
                  </div>
                  {searchResults.entries.map((e) => (
                   <button
                      key={e.id}
                      onClick={() => {
                        navigate({ to: "/admin/entries", search: { q: query } });
                        setShowResults(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">
                        {users.find((u) => u.id === e.collectorId)?.name ||
                          e.collectorName ||
                          "Unknown TC"}{" "}
                        · Train {e.trainNumber}
                      </span>
                      <span className="text-xs font-semibold text-primary">
                        {formatINR(e.totalAmount ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.complaints.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                    Complaints
                  </div>
                  {searchResults.complaints.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        navigate({ to: "/admin/complaints", search: { q: query } });
                        setShowResults(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate">
                        #{c.number} · {c.category}
                      </span>
                      <span className="chip text-[10px]">{c.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          const tone =
            c.tone === "primary"
              ? "bg-primary text-primary-foreground"
              : c.tone === "warning"
                ? "bg-warning/15 text-warning-foreground"
                : c.tone === "success"
                  ? "bg-success/15 text-success"
                  : "bg-card";
          return (
            <div
              key={c.label}
              className={`rounded-2xl border border-border p-4 shadow-card ${tone}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {c.label}
                </div>
                <Icon className="h-4 w-4 opacity-80" />
              </div>
              <div className="mt-2 text-2xl font-bold">{c.value}</div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Latest Complaints"
          to="/admin/complaints"
          empty={recentComplaints.length === 0}
        >
          <ul className="divide-y divide-border">
            {recentComplaints.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    #{c.number} · {c.category}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {users.find((u) => u.id === c.collectorId)?.name ||
                      c.collectorName ||
                      (c.collectorId ? `TC (${c.collectorId.slice(0, 6)})` : "Unknown TC")}{" "}
                    · Train {c.train}
                  </div>
                </div>
                <span className="chip">{c.status}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent Entries" to="/admin/entries" empty={recentEntries.length === 0}>
          <ul className="divide-y divide-border">
            {recentEntries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {users.find((u) => u.id === e.collectorId)?.name ||
                      e.collectorName ||
                      (e.collectorId ? `TC (${e.collectorId.slice(0, 6)})` : "Unknown TC")}{" "}
                    · Train {e.trainNumber}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatDate(e.date)} · {e.totalCases ?? 0} cases
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">{formatINR(e.totalAmount ?? 0)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </AdminLayout>
  );
}

function Panel({
  title,
  to,
  empty,
  children,
}: {
  title: string;
  to: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <Link
          to={to as "/admin"}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {empty ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</div>
      ) : (
        children
      )}
    </div>
  );
}