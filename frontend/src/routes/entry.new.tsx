import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CollectorLayout } from "@/components/CollectorLayout";
import { useAuth } from "@/services/AuthContext";
import {
  saveDraftEntry,
  updateDraftEntry,
  submitEntries,
  fetchMyEntries,
  deleteEntry,
  type FineCategory,
  type WorkingIn,
  type SquadName,
  type Entry,
} from "@/services/entries";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Plus,
  Minus,
  Send,
  Train,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  IndianRupee,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { isRestrictedDuty } from "@/lib/dutyStatus";

export const Route = createFileRoute("/entry/new")({
  head: () => ({ meta: [{ title: "New Daily Entry · TC System" }] }),
  component: NewEntryPage,
});

const WORKING_IN_OPTIONS: WorkingIn[] = ["SQD", "LINK", "STN"];

const SQUAD_OPTIONS: SquadName[] = [
  "VIRAT", "VEDANT", "VIJAY", "VIKRANT", "VIHAN",
  "OPEN", "ALFA", "BRAVO", "CHARLI", "TEJAS", "NAG-MISC" ,"GONDIA", "DGG-MISC SQD", "NIR-MISC SQD",
];

const TRAIN_STATUSES = ["REST", "LAP", "CL", "SCL", "CCL", "LEAVE", "SICK", "ML", "STN"];

const CATEGORIES = [
  { key: "A" as const, label: "A Case", color: "bg-blue-500",   hint: "WT / Fare evader" },
  { key: "B" as const, label: "B Case", color: "bg-violet-500", hint: "Excess fare" },
  { key: "C" as const, label: "C Case", color: "bg-amber-500",  hint: "Without ticket" },
  { key: "D" as const, label: "D Case", color: "bg-orange-500", hint: "Luggage / parcel" },
  { key: "E" as const, label: "E Case", color: "bg-teal-500",   hint: "Other" },
  { key: "smoking" as const, label: "Smoking", color: "bg-red-500", hint: "Smoking on board" },
  { key: "litteringCases" as const, label: "Littering", color: "bg-lime-600", hint: "Littering cases" },
] as const;

type CatKey = (typeof CATEGORIES)[number]["key"];

function emptyFine(): FineCategory { return { cases: 0, amount: 0 }; }

interface TrainRow {
  localId: string;
  firestoreId?: string;
  trainNumber: string;
  workingIn: WorkingIn;
  squadName: SquadName | "";
  A: FineCategory; B: FineCategory; C: FineCategory;
  D: FineCategory; E: FineCategory; smoking: FineCategory;
  litteringCases: FineCategory;
  doctorFee: number;
  saving: boolean;
  saved: boolean;
  expanded: boolean;
}


function newRow(): TrainRow {
  return {
    localId: crypto.randomUUID(),
    trainNumber: "",
    workingIn: "SQD",
    squadName: "",
    A: emptyFine(), B: emptyFine(), C: emptyFine(),
    D: emptyFine(), E: emptyFine(), smoking: emptyFine(),
    litteringCases: emptyFine(),
    doctorFee: 0,
    saving: false, saved: false, expanded: true,
  };
}

// Convert a saved draft entry (from Firestore) back into an editable row
function entryToRow(e: Entry): TrainRow {
  return {
    localId: crypto.randomUUID(),
    firestoreId: e.id,
    trainNumber: e.trainNumber === "—" ? "" : e.trainNumber,
    workingIn: e.workingIn,
    squadName: e.squadName,
    A: e.A, B: e.B, C: e.C, D: e.D, E: e.E, smoking: e.smoking,
    litteringCases: e.litteringCases ?? emptyFine(),
    doctorFee: e.doctorFee ?? 0,
    saving: false,
    saved: true,
    expanded: true,
  };
}


function rowTotals(row: TrainRow) {
  const cats: FineCategory[] = [row.A, row.B, row.C, row.D, row.E, row.smoking, row.litteringCases];
  return {
    cases: cats.reduce((a, c) => a + (c.cases || 0), 0),
    amount: cats.reduce((a, c) => a + (c.amount || 0), 0) + (row.doctorFee || 0),
  };
}

function isStatusOnly(train: string) {
  return TRAIN_STATUSES.includes(train.toUpperCase().trim());
}

// ── Amount input dialog (shows when TC long-presses a category) ──────────────
function AmountModal({
  label,
  value,
  onSave,
  onClose,
}: {
  label: string;
  value: FineCategory;
  onSave: (breakdown: { caseAmt: number; penaltyAmt: number; gstAmt: number }) => void;
  onClose: () => void;
}) {
  // Pre-fill from previously saved breakdown, so reopening shows all 3 values
  const [caseAmt, setCaseAmt] = useState(value.caseAmt ? String(value.caseAmt) : "");
  const [fineAmt, setFineAmt] = useState(value.penaltyAmt ? String(value.penaltyAmt) : "");
  const [gstAmt, setGstAmt] = useState(value.gstAmt ? String(value.gstAmt) : "");

  const total = (parseInt(caseAmt, 10) || 0) + (parseInt(fineAmt, 10) || 0) + (parseInt(gstAmt, 10) || 0);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xs rounded-2xl bg-card p-5 shadow-elevated">
        <h3 className="mb-3 text-base font-bold">{label} — Amount Details</h3>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Case Amount
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                inputMode="numeric"
                value={caseAmt}
                onChange={(e) => setCaseAmt(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent text-xl font-bold outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Penalty Amount
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <input
                inputMode="numeric"
                value={fineAmt}
                onChange={(e) => setFineAmt(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent text-xl font-bold outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              GST Amount
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <input
                inputMode="numeric"
                value={gstAmt}
                onChange={(e) => setGstAmt(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent text-xl font-bold outline-none"
              />
            </div>
          </div>

          {/* Live total */}
          <div className="flex items-center justify-between rounded-xl bg-primary-soft px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Total</span>
            <span className="text-lg font-black text-primary">{formatINR(total)}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                caseAmt: parseInt(caseAmt, 10) || 0,
                penaltyAmt: parseInt(fineAmt, 10) || 0,
                gstAmt: parseInt(gstAmt, 10) || 0,
              });
              onClose();
            }}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tally counter card for one category ───────────────────────────────────────
function CategoryCounter({
  cat,
  value,
  onIncrement,
  onDecrement,
  onAmountChange,
}: {
  cat: (typeof CATEGORIES)[number];
  value: FineCategory;
  onIncrement: () => void;
  onDecrement: () => void;
  onAmountChange: (breakdown: { caseAmt: number; penaltyAmt: number; gstAmt: number }) => void;
}) {
  const [showAmt, setShowAmt] = useState(false);
  const active = value.cases > 0;

  return (
    <>
      <div
        
        className={`rounded-2xl border p-5 transition-all select-none ${
          active
            ? "border-primary/40 bg-primary-soft shadow-card"
            : "border-border bg-card"
        }`}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${cat.color}`} />
              <span className="text-sm font-bold">{cat.label}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{cat.hint}</div>
          </div>
          {/* Amount badge — tap to edit */}
          
          <button
            onClick={() => setShowAmt(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
          >
            {value.amount > 0 ? formatINR(value.amount) : "Set ₹"}
          </button>
        </div>

       {/* Tally counter */}
<div className="flex items-center justify-center">
  <div className="flex items-center gap-5 rounded-2xl border border-blue-200 bg-white px-4 py-2 shadow-sm">

    <button
      onClick={onDecrement}
      disabled={value.cases === 0}
      className="grid h-8 w-8 place-items-center rounded-full border border-blue-200 bg-white text-blue-500 hover:bg-blue-50 active:scale-95 disabled:opacity-40"
    >
      <Minus className="h-4 w-4" strokeWidth={2.5} />
    </button>

    <div className="text-center">
      <div
        className={`text-2xl font-black tabular-nums ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {value.cases}
      </div>
      <div className="text-[9px] text-gray-400">Cases</div>
    </div>

    <button
      onClick={onIncrement}
      className="grid h-8 w-8 place-items-center rounded-full border border-blue-200 bg-white text-blue-500 hover:bg-blue-50 active:scale-95"
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} />
    </button>

  </div>
</div></div>

     {showAmt && (
        <AmountModal
          label={cat.label}
          value={value}
          onSave={onAmountChange}
          onClose={() => setShowAmt(false)}
        />
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
function NewEntryPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

const [rows, setRows] = useState<TrainRow[]>([newRow()]);
  const [submitting, setSubmitting] = useState(false);
  // Track which row is currently "active" (expanded for tally entry)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialized = useRef(false);
  const rowsRef = useRef<TrainRow[]>(rows);

  // Always keep rowsRef in sync with the latest rows, so we can force-save
  // the freshest data even from an effect cleanup (e.g. before leaving page)
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Load today's existing draft entries — so if the TC leaves this page
  // (back button, bottom nav) and comes back, their unfinished entry reappears
  const { data: myEntries } = useQuery({
    queryKey: ["entries", user?.uid],
    queryFn: () => fetchMyEntries(user!.uid),
    enabled: !!user,
  });

  useEffect(() => {
    if (initialized.current || !myEntries) return;
    const todaysDrafts = myEntries.filter((e) => e.date === today && e.status === "draft");
    if (todaysDrafts.length > 0) {
      setRows(todaysDrafts.map(entryToRow));
    }
    initialized.current = true;
  }, [myEntries, today]);

  useEffect(() => () => { Object.values(saveTimers.current).forEach(clearTimeout); }, []);

  // if (authLoading || !user || !profile) return null;

  // ── Row state helpers ──
  function setRow(localId: string, patch: Partial<TrainRow>) {
    setRows((rs) => rs.map((r) => r.localId === localId ? { ...r, ...patch } : r));
  }

 // ── Auto-save with debounce ── returns the Firestore ID (existing or newly
  // created), or null on failure. Callers must use this returned value —
  // never read `firestoreId` back off a stale `rows` closure right after.
  const triggerSave = useCallback(async (localId: string, latestRows: TrainRow[]): Promise<string | null> => {
    const row = latestRows.find((r) => r.localId === localId);
    if (!row) return null;

    setRows((rs) => rs.map((r) => r.localId === localId ? { ...r, saving: true } : r));

    const { cases, amount } = rowTotals(row);
    const payload: Omit<Entry, "id" | "createdAt" | "submittedAt"> = {
      collectorId: user.uid,
      collectorName: profile.name,
      collectorBase: profile.base,
      pfNo: profile.pfNo ?? "",
      date: today,
      trainNumber: row.trainNumber || "—",
      workingIn: row.workingIn,
      squadName: row.squadName as SquadName,
      A: row.A, B: row.B, C: row.C, D: row.D, E: row.E, smoking: row.smoking,
      litteringCases: row.litteringCases,
      doctorFee: row.doctorFee,
      totalCases: cases,
      totalAmount: amount,
      status: "draft",
    };

    try {
      if (row.firestoreId) {
        await updateDraftEntry(row.firestoreId, payload);
        setRows((rs) => rs.map((r) => r.localId === localId ? { ...r, saving: false, saved: true } : r));
        return row.firestoreId;
      } else {
        const id = await saveDraftEntry(payload);
        setRows((rs) => rs.map((r) => r.localId === localId ? { ...r, saving: false, saved: true, firestoreId: id } : r));
        return id;
      }
    } catch {
      setRows((rs) => rs.map((r) => r.localId === localId ? { ...r, saving: false } : r));
      toast.error("Auto-save failed");
      return null;
    }
  }, [user, profile, today]);

  // Force-flush any pending (debounced) save the instant the user navigates
  // away from this page (bottom-nav tabs, back button) — this is a *component*
  // unmount effect, separate from the timer-clearing one above.
  useEffect(() => {
    return () => {
      Object.keys(saveTimers.current).forEach((localId) => {
        clearTimeout(saveTimers.current[localId]);
        triggerSave(localId, rowsRef.current);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 function scheduleSave(localId: string, updatedRows: TrainRow[]) {
    clearTimeout(saveTimers.current[localId]);
    // Short debounce to batch rapid taps
    saveTimers.current[localId] = setTimeout(() => triggerSave(localId, updatedRows), 150);
  }

  // Block access entirely if the TC is on REST/Leave/etc. — send them to My Entries instead
  useEffect(() => {
    if (!profile) return;
    if (isRestrictedDuty(profile.dutyStatus, profile.dutyStatusSetAt)) {
      toast.error("New entries are disabled while you're on leave/rest");
      navigate({ to: "/entries" });
    }
  }, [profile, navigate]);

  if (authLoading || !user || !profile) return null;


  // ── Tally increment / decrement ──
  function increment(localId: string, key: CatKey) {
    setRows((rs) => {
      const next = rs.map((r) =>
        r.localId === localId
          ? { ...r, [key]: { ...r[key], cases: (r[key].cases || 0) + 1 } }
          : r
      );
      scheduleSave(localId, next);
      return next;
    });
  }

  function decrement(localId: string, key: CatKey) {
    setRows((rs) => {
      const next = rs.map((r) =>
        r.localId === localId
          ? { ...r, [key]: { ...r[key], cases: Math.max(0, (r[key].cases || 0) - 1) } }
          : r
      );
      scheduleSave(localId, next);
      return next;
    });
  }

 function setAmount(
    localId: string,
    key: CatKey,
    breakdown: { caseAmt: number; penaltyAmt: number; gstAmt: number },
  ) {
    setRows((rs) => {
      const next = rs.map((r) =>
        r.localId === localId
          ? {
              ...r,
              [key]: {
                ...r[key],
                caseAmt: breakdown.caseAmt,
                penaltyAmt: breakdown.penaltyAmt,
                gstAmt: breakdown.gstAmt,
                amount: breakdown.caseAmt + breakdown.penaltyAmt + breakdown.gstAmt,
              },
            }
          : r
      );
      scheduleSave(localId, next);
      return next;
    });
  }

  function updateMeta(localId: string, patch: Partial<TrainRow>) {
    setRows((rs) => {
      const next = rs.map((r) => r.localId === localId ? { ...r, ...patch } : r);
      scheduleSave(localId, next);
      return next;
    });
  }

  async function manualSave(localId: string) {
    clearTimeout(saveTimers.current[localId]);
    await triggerSave(localId, rows);
    toast.success("Saved as draft");
  }

 async function handleSubmitAll() {
    // Cancel ALL pending debounced autosaves first — otherwise a leftover
    // timer can fire AFTER submitEntries() and silently overwrite
    // status back to "draft" (it always writes status: "draft").
    Object.values(saveTimers.current).forEach(clearTimeout);
    saveTimers.current = {};

    // Force-save every row with a train number (not just "unsaved" ones) and
    // collect their FRESH Firestore IDs directly from triggerSave's return
    // value — do NOT re-read `rows` afterwards, since that local variable is
    // a stale snapshot from before these saves completed and won't have the
    // newly-created IDs yet.
    const rowsToFlush = rows.filter((r) => r.trainNumber);
    const freshIds = await Promise.all(rowsToFlush.map((r) => triggerSave(r.localId, rows)));

    const ids = Array.from(new Set(freshIds.filter((id): id is string => Boolean(id))));

    if (!ids.length) { toast.error("No saved rows to submit"); return; }

    setSubmitting(true);
    try {
      await submitEntries(ids);
      const grandCases = rows.reduce((a, r) => a + rowTotals(r).cases, 0);
      const grandAmt   = rows.reduce((a, r) => a + rowTotals(r).amount, 0);
      toast.success(`${ids.length} entries submitted`, {
        description: `${grandCases} cases · ${formatINR(grandAmt)}`,
      });
      navigate({ to: "/entries" });
    } catch {
      toast.error("Submit failed — please retry");
    } finally {
      setSubmitting(false);
    }
  }

  const grandCases = rows.reduce((a, r) => a + rowTotals(r).cases, 0);
  const grandAmt   = rows.reduce((a, r) => a + rowTotals(r).amount, 0);

  return (
    <CollectorLayout>
     <div className="mb-6">
        <h1 className="text-2xl font-bold">New Daily Entry</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tap <strong>+</strong> each time you catch a case — it saves instantly.
        </p>
      </div>

      {/* Profile bar */}
<div className="mb-6 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3.5 text-sm">        <span className="font-semibold">{profile.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="chip">{profile.base}</span>
        {profile.pfNo && (
          <span className="font-mono text-xs text-muted-foreground">{profile.pfNo}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* Train rows */}
      <div className="space-y-5">
        {rows.map((row, idx) => {
          const { cases, amount } = rowTotals(row);
          const statusOnly = isStatusOnly(row.trainNumber);

          return (
            <div
              key={row.localId}
              className={`rounded-2xl border bg-background shadow-card transition-colors ${
                row.saved ? "border-primary/30" : "border-border"
              }`}
            >
              {/* ── Row header ── */}

              <div className="flex items-center gap-2.5 px-5 py-4">                
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </div>

                {/* Train number */}
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
                  <Train className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={row.trainNumber}
                    onChange={(e) => updateMeta(row.localId, { trainNumber: e.target.value })}
                    placeholder="Train no. or status…"
                    className="flex-1 bg-transparent text-sm font-bold tracking-wide outline-none"
                  />
                </div>

                {/* Save indicator */}
                {row.saving ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : row.saved ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : null}

                {/* Collapse / expand */}
                <button
                  onClick={() => setRow(row.localId, { expanded: !row.expanded })}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  {row.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

{/* Delete row */}
                {rows.length > 1 && (
                  <button
                    onClick={async () => {
                      clearTimeout(saveTimers.current[row.localId]);
                      if (row.firestoreId) {
                        try {
                          await deleteEntry(row.firestoreId);
                        } catch {
                          toast.error("Failed to delete — please retry");
                          return;
                        }
                      }
                      setRows((rs) => rs.filter((r) => r.localId !== row.localId));
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
                {row.expanded && (
                <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">

                  {/* Working In + Squad */}

                  <div className="grid grid-cols-3 gap-4">                    
                    <div>
                      <SectionLabel>Working In</SectionLabel>
                      <div className="flex gap-1.5">
                        {WORKING_IN_OPTIONS.map((w) => (
                          <button
                            key={w}
                            onClick={() => updateMeta(row.localId, { workingIn: w })}
                            className={`flex-1 rounded-lg border py-2.5 text-xs font-bold transition-colors ${
                              row.workingIn === w
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:bg-muted"
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Squad / Team</SectionLabel>
                      <select
                        value={row.squadName}
                        onChange={(e) => updateMeta(row.localId, { squadName: e.target.value as SquadName })}
                        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-bold outline-none focus:border-ring"
                      >
                        <option value="">— None —</option>
                        {SQUAD_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <SectionLabel>Doctor Fee</SectionLabel>
                      <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
                        <IndianRupee className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          inputMode="numeric"
                          value={row.doctorFee === 0 ? "" : String(row.doctorFee)}
                          onChange={(e) =>
                            updateMeta(row.localId, {
                              doctorFee: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                            })
                          }
                          placeholder="0"
                          className="w-full bg-transparent text-sm font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status shortcuts */}
                  {/* <div>
                    <SectionLabel>Quick status (no train today)</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {TRAIN_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateMeta(row.localId, { trainNumber: s })}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            row.trainNumber === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div> */}

                  {/* ── Tally counters — only show if actual train ── */}
                  {!statusOnly && (
                    <div>
                      <SectionLabel>Tap + for each case you catch</SectionLabel>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {CATEGORIES.map((cat) => (
                          <CategoryCounter
                            key={cat.key}
                            cat={cat}
                            value={row[cat.key]}
                            onIncrement={() => increment(row.localId, cat.key)}
                            onDecrement={() => decrement(row.localId, cat.key)}
                            onAmountChange={(v) => setAmount(row.localId, cat.key, v)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row footer: totals + manual save */}

                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-5 py-4">                
                      <div className="flex gap-5">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Cases</div>
                        <div className="text-2xl font-black text-primary">{cases}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Amount</div>
                        <div className="text-2xl font-black text-primary">{formatINR(amount)}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => manualSave(row.localId)}
                      disabled={row.saving || !row.trainNumber}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-40"
                    >
                      {row.saving
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />}
                      Save draft
                    </button>
                  </div>

                </div>
              )}

              {/* Collapsed summary strip */}
              {!row.expanded && (
                <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {row.workingIn}{row.squadName ? ` · ${row.squadName}` : ""}
                  </span>
                  <span className="font-bold text-foreground">
                    {cases} cases · {formatINR(amount)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

     <button
        onClick={() => setRows((rs) => [...rs, newRow()])}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add another train
      </button>

      {/* Spacer */}
      <div className="h-28" />

      {/* ── Sticky submit bar ── */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex-1 rounded-xl bg-primary-soft px-4 py-2">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-primary">
              <span>Total Cases</span>
              <span>Total Amount</span>
            </div>
            <div className="flex justify-between">
              <span className="text-2xl font-black text-primary">{grandCases}</span>
              <span className="text-2xl font-black text-primary">{formatINR(grandAmt)}</span>
            </div>
          </div>
          <button
            onClick={handleSubmitAll}
            disabled={submitting || rows.every((r) => !r.trainNumber)}
            className="flex h-16 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-card disabled:opacity-50"
          >
            {submitting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Send className="h-5 w-5" />}
            Submit<br />duty
          </button>
        </div>
      </div>
    </CollectorLayout>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}