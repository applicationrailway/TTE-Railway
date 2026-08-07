import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CollectorLayout } from "@/components/CollectorLayout";
import { useAuth } from "@/services/AuthContext";
import {
  fetchMyEntries,
  updateDraftEntry,
  type Entry,
  type FineCategory,
  type WorkingIn,
  type SquadName,
} from "@/services/entries";
import { formatINR, formatDate } from "@/lib/format";
import { isRestrictedDuty } from "@/lib/dutyStatus";
import { useMemo, useState } from "react";
import {
  Search, Plus, ClipboardList, Train, Pencil, X,
  Minus, IndianRupee, Loader2, Save,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/entries")({
  head: () => ({ meta: [{ title: "My Entries · TC System" }] }),
  component: EntriesPage,
});

const WORKING_IN_OPTIONS: WorkingIn[] = ["SQD", "LINK", "stn"];
const SQUAD_OPTIONS: SquadName[] = [
  "VIRAT", "VEDANT", "VIJAY", "VIKRANT", "VIHAN",
  "OPEN", "ALFA", "BRAVO", "CHARLI", "TEJAS",
];
const CATEGORIES = [
  { key: "A" as const, label: "A Case", color: "bg-blue-500",   hint: "WT / Fare evader" },
  { key: "B" as const, label: "B Case", color: "bg-violet-500", hint: "Excess fare" },
  { key: "C" as const, label: "C Case", color: "bg-amber-500",  hint: "Without ticket" },
  { key: "D" as const, label: "D Case", color: "bg-orange-500", hint: "Luggage / parcel" },
  { key: "E" as const, label: "E Case", color: "bg-teal-500",   hint: "Other" },
  { key: "smoking" as const, label: "Smoking", color: "bg-red-500", hint: "Smoking on board" },
] as const;
type CatKey = (typeof CATEGORIES)[number]["key"];

// Editable only same-day (until midnight of the submission date) AND only once
function canEditEntry(e: Entry): boolean {
  if (e.status !== "submitted") return false;
  if (e.edited) return false;
  const endOfSubmissionDay = new Date(`${e.date}T23:59:59.999`);
  return Date.now() <= endOfSubmissionDay.getTime();
}

function editDisabledReason(e: Entry): string | undefined {
  if (e.edited) return "You've already used your one edit for this entry";
  if (!canEditEntry(e)) return "Edit window has closed for this date";
  return undefined;
}

function EntriesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const restricted = isRestrictedDuty(profile?.dutyStatus, profile?.dutyStatusSetAt);
  const queryClient = useQueryClient();
  const { data: entries = [] } = useQuery({
    queryKey: ["entries", user?.uid],
    queryFn: () => fetchMyEntries(user!.uid),
    enabled: !!user,
  });
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => {
          if (dateFrom && e.date < dateFrom) return false;
          if (dateTo && e.date > dateTo) return false;
          if (q && !e.trainNumber.includes(q.trim())) return false;
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, q, dateFrom, dateTo],
  );

  if (authLoading || !user) return null;

  return (
    <CollectorLayout>
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">My Entries</h1>
          <p className="text-sm text-muted-foreground">{entries.length} total submissions</p>
        </div>
        {!restricted && (
          <Link
            to="/entry/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
          >
            <Plus className="h-4 w-4" /> New
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by train number"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-0.5 sm:flex-none">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col gap-0.5 sm:flex-none">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState restricted={restricted} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((e) => {
              const editable = canEditEntry(e);
              const reason = editDisabledReason(e);
              return (
                <div key={e.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{formatDate(e.date)}</div>
                    <span className="chip">{e.working}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Train" value={e.trainNumber} />
                    <Stat label="Cases" value={String(e.totalCases)} />
                    <Stat label="Amount" value={formatINR(e.totalAmount)} highlight />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setViewingEntry(e)}
                      className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => editable && setEditingEntry(e)}
                      disabled={!editable}
                      title={reason}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Train</th>
                  <th className="px-4 py-3">Working</th>
                  <th className="px-4 py-3 text-right">Cases</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => {
                  const editable = canEditEntry(e);
                  const reason = editDisabledReason(e);
                  return (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-mono font-semibold">
                          <Train className="h-3.5 w-3.5 text-primary" /> {e.trainNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="chip">{e.working}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{e.totalCases}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">
                        {formatINR(e.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => editable && setEditingEntry(e)}
                          disabled={!editable}
                          title={reason}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

     {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["entries", user?.uid] })}
        />
      )}

      {viewingEntry && (
        <ViewEntryModal entry={viewingEntry} onClose={() => setViewingEntry(null)} />
      )}
    </CollectorLayout>
  );
}

function ViewEntryModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const rows: { label: string; cases: number; amount: number }[] = [
    { label: "A Case", cases: entry.A?.cases ?? 0, amount: entry.A?.amount ?? 0 },
    { label: "B Case", cases: entry.B?.cases ?? 0, amount: entry.B?.amount ?? 0 },
    { label: "C Case", cases: entry.C?.cases ?? 0, amount: entry.C?.amount ?? 0 },
    { label: "D Case", cases: entry.D?.cases ?? 0, amount: entry.D?.amount ?? 0 },
    { label: "E Case", cases: entry.E?.cases ?? 0, amount: entry.E?.amount ?? 0 },
    { label: "Smoking", cases: entry.smoking?.cases ?? 0, amount: entry.smoking?.amount ?? 0 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-4"
      onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div className="my-8 w-full max-w-md rounded-2xl bg-card p-5 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Entry — {formatDate(entry.date)}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Train</span>
            <span className="font-mono font-semibold">{entry.trainNumber}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working In</span>
            <span className="font-medium">{entry.workingIn}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Squad</span>
            <span className="font-medium">{entry.squadName || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <span className="font-medium capitalize">{entry.status}</span>
          </div>

          <div className="pt-1">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cases breakdown
            </div>
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">
                    {r.cases} cases · {formatINR(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-primary-soft px-4 py-3">
            <div>
              <div className="text-[10px] font-semibold uppercase text-primary">Total Cases</div>
              <div className="text-xl font-black text-primary">{entry.totalCases}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase text-primary">Total Amount</div>
              <div className="text-xl font-black text-primary">{formatINR(entry.totalAmount)}</div>
            </div>
          </div>

          {entry.adminRemark && (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Admin Remark
              </div>
              <div className="mt-0.5 text-sm">{entry.adminRemark}</div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function EmptyState({ restricted }: { restricted: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <ClipboardList className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold">No entries yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your first daily entry to see it here.
      </p>
      {!restricted && (
        <Link
          to="/entry/new"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New Entry
        </Link>
      )}
    </div>
  );
}

function EditEntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [trainNumber, setTrainNumber] = useState(entry.trainNumber === "—" ? "" : entry.trainNumber);
  const [workingIn, setWorkingIn] = useState<WorkingIn>(entry.workingIn);
  const [squadName, setSquadName] = useState<SquadName | "">(entry.squadName ?? "");
  const [cats, setCats] = useState<Record<CatKey, FineCategory>>({
    A: entry.A, B: entry.B, C: entry.C, D: entry.D, E: entry.E, smoking: entry.smoking,
  });
  const [amtModalKey, setAmtModalKey] = useState<CatKey | null>(null);
  const [saving, setSaving] = useState(false);

  const totalCases = Object.values(cats).reduce((a, c) => a + (c.cases || 0), 0);
  const totalAmount = Object.values(cats).reduce((a, c) => a + (c.amount || 0), 0);

  function inc(key: CatKey) {
    setCats((c) => ({ ...c, [key]: { ...c[key], cases: (c[key].cases || 0) + 1 } }));
  }
  function dec(key: CatKey) {
    setCats((c) => ({ ...c, [key]: { ...c[key], cases: Math.max(0, (c[key].cases || 0) - 1) } }));
  }
  function setAmt(key: CatKey, amount: number) {
    setCats((c) => ({ ...c, [key]: { ...c[key], amount } }));
  }

  async function handleSave() {
    if (!entry.id) return;
    setSaving(true);
    try {
      await updateDraftEntry(entry.id, {
        trainNumber: trainNumber || "—",
        workingIn,
        squadName: squadName as SquadName,
        A: cats.A, B: cats.B, C: cats.C, D: cats.D, E: cats.E, smoking: cats.smoking,
        totalCases,
        totalAmount,
        edited: true, // lock further edits after this save
      });
      toast.success("Entry updated — this was your one allowed edit for this entry");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to update entry");
    } finally {
      setSaving(false);
    }
  }

  const activeCat = CATEGORIES.find((c) => c.key === amtModalKey);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-card p-5 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Entry — {formatDate(entry.date)}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5">
            <Train className="h-4 w-4 text-muted-foreground" />
            <input
              value={trainNumber}
              onChange={(e) => setTrainNumber(e.target.value)}
              placeholder="Train no. or status…"
              className="flex-1 bg-transparent text-sm font-bold tracking-wide outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Working In</div>
              <div className="flex gap-1.5">
                {WORKING_IN_OPTIONS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWorkingIn(w)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-colors ${
                      workingIn === w ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Squad / Team</div>
              <select
                value={squadName}
                onChange={(e) => setSquadName(e.target.value as SquadName)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-bold outline-none"
              >
                <option value="">— None —</option>
                {SQUAD_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cases
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const value = cats[cat.key];
                const active = value.cases > 0;
                return (
                  <div
                    key={cat.key}
                    className={`rounded-2xl border p-4 ${active ? "border-primary/40 bg-primary-soft" : "border-border bg-card"}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${cat.color}`} />
                          <span className="text-sm font-bold">{cat.label}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{cat.hint}</div>
                      </div>
                      <button
                        onClick={() => setAmtModalKey(cat.key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                          value.amount > 0 ? "bg-primary text-primary-foreground" : "border-2 border-dashed border-border text-muted-foreground"
                        }`}
                      >
                        {value.amount > 0 ? formatINR(value.amount) : "Set ₹"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => dec(cat.key)}
                        disabled={value.cases === 0}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background disabled:opacity-30"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center text-2xl font-black tabular-nums">
                        {value.cases}
                      </div>
                      <button
                        onClick={() => inc(cat.key)}
                        className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
            <div className="flex gap-5">
              <div>
                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Total Cases</div>
                <div className="text-xl font-black text-primary">{totalCases}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-muted-foreground">Total Amount</div>
                <div className="text-xl font-black text-primary">{formatINR(totalAmount)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {activeCat && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-foreground/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAmtModalKey(null); }}
        >
          <SimpleAmountEditor
            label={activeCat.label}
            value={cats[activeCat.key].amount}
            onSave={(v) => { setAmt(activeCat.key, v); setAmtModalKey(null); }}
            onClose={() => setAmtModalKey(null)}
          />
        </div>
      )}
    </div>
  );
}

function SimpleAmountEditor({ label, value, onSave, onClose }: {
  label: string; value: number; onSave: (v: number) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(value === 0 ? "" : String(value));
  return (
    <div className="w-full max-w-xs rounded-2xl bg-card p-5 shadow-elevated">
      <h3 className="mb-3 text-base font-bold">{label} — Amount</h3>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-3">
        <IndianRupee className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
          className="flex-1 bg-transparent text-xl font-bold outline-none"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">
          Cancel
        </button>
        <button
          onClick={() => onSave(parseInt(val, 10) || 0)}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Save
        </button>
      </div>
    </div>
  );
}