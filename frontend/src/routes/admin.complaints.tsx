import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  fetchAllComplaints,
  updateComplaintStatus,
  updateComplaintDetails,
  type ComplaintStatus,
} from "@/services/complaints";
import { fetchAllUsers } from "@/services/users";
import { formatDate } from "@/lib/format";
import { useMemo, useState, useEffect } from "react";
import { Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ContactShareModal } from "@/components/ContactShareModal";
export const Route = createFileRoute("/admin/complaints")({
  head: () => ({ meta: [{ title: "Complaints · Admin" }] }),
  component: AdminComplaintsPage,
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
});

const STATUSES: ComplaintStatus[] = ["Pending", "Under Review", "Resolved", "Closed"];
const STATUS_STYLE: Record<ComplaintStatus, string> = {
  Pending: "bg-warning/20 text-warning-foreground",
  "Under Review": "bg-primary-soft text-primary",
  Resolved: "bg-success/15 text-success",
  Closed: "bg-muted text-muted-foreground",
};
// Bigger, clearer highlight for top-right corner badge
const STATUS_HIGHLIGHT: Record<ComplaintStatus, { label: string; className: string; dot: string }> = {
  Pending: {
    label: "Not Started",
    className: "bg-destructive/15 text-destructive border border-destructive/30",
    dot: "bg-destructive",
  },
  "Under Review": {
    label: "Ongoing",
    className: "bg-warning/20 text-warning-foreground border border-warning/40",
    dot: "bg-warning animate-pulse",
  },
  Resolved: {
    label: "Resolved",
    className: "bg-success/15 text-success border border-success/40",
    dot: "bg-success",
  },
  Closed: {
    label: "Closed",
    className: "bg-muted text-muted-foreground border border-border",
    dot: "bg-muted-foreground",
  },
};

function AdminComplaintsPage() {
  const { q: urlQ } = Route.useSearch();


  const queryClient = useQueryClient();
  const { data: complaints = [] } = useQuery({
    queryKey: ["admin", "complaints"],
    queryFn: fetchAllComplaints,
  });
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: fetchAllUsers });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ComplaintStatus>("");

  // Pre-fill search box from dashboard universal search (?q=...)
  useEffect(() => {
    if (urlQ) {
      setQ(urlQ);
    }
  }, [urlQ]);

  const rows = useMemo(
    () =>
      complaints
        .filter((c) => (status ? c.status === status : true))
        .filter((c) => {
          if (!q) return true;
          const u = users.find((u) => u.id === c.collectorId);
          const s = q.toLowerCase();
          return (
            c.train.toLowerCase().includes(s) ||
            c.category.toLowerCase().includes(s) ||
            String(c.number).includes(s) ||
            (u?.name.toLowerCase().includes(s) ?? false)
          );
        })
        .sort((a, b) => b.number - a.number),
    [complaints, users, q, status],
  );

  async function update(id: string | undefined, s: ComplaintStatus) {
    if (!id) return;
    await updateComplaintStatus(id, s);
    toast.success(`Marked as ${s}`);
    queryClient.invalidateQueries({ queryKey: ["admin", "complaints"] });
  }

  async function saveDetails(id: string | undefined, remark: string, eta: string) {
    if (!id) return;
    await updateComplaintDetails(id, { adminRemark: remark, expectedResolutionDate: eta });
    toast.success("Update saved");
    queryClient.invalidateQueries({ queryKey: ["admin", "complaints"] });
  }
  

  return (
    <AdminLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Complaint Management</h1>
        <p className="text-sm text-muted-foreground">Review, escalate and close complaints.</p>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by collector, train, category, #id"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!status} onClick={() => setStatus("")} label="All" />
          {STATUSES.map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => setStatus(s)} label={s} />
          ))}
        </div>
      </div>

      <div className="grid gap-3">
      {rows.map((c) => {
          const u = users.find((u) => u.id === c.collectorId);
          const collectorLabel =
            u?.name || c.collectorName || `TC (${c.collectorId.slice(0, 6)})`;
          return (
            < ComplaintCard
              key={c.id}
              c={c}
              collectorLabel={collectorLabel}
              onStatusChange={update}
              onSaveDetails={saveDetails}
            />
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No complaints match.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
})  {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground border border-border hover:bg-muted"
      }`}
      
    >
      {label}
    </button>
  );
}
function ComplaintCard({
  c,
  collectorLabel,
  onStatusChange,
  onSaveDetails,
}: {
  c: import("@/services/complaints").Complaint;
  collectorLabel: string;
  onStatusChange: (id: string | undefined, s: ComplaintStatus) => void;
  onSaveDetails: (id: string | undefined, remark: string, eta: string) => void;
}) {
  const [remark, setRemark] = useState(c.adminRemark ?? "");
  const [eta, setEta] = useState(c.expectedResolutionDate ?? "");
  const [editing, setEditing] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const highlight = STATUS_HIGHLIGHT[c.status];

  const shareMessage =
    `Complaint #${c.number} — ${c.category}\n` +
    `Train: ${c.train}${c.station ? ` · Station: ${c.station}` : ""}\n` +
    `Filed by: ${collectorLabel}\n` +
    `Status: ${c.status}\n\n` +
    `${c.description}` +
    (c.adminRemark ? `\n\nUpdate: ${c.adminRemark}` : "") +
    (c.expectedResolutionDate ? `\nExpected resolution: ${c.expectedResolutionDate}` : "");

  function handleSave() {
    onSaveDetails(c.id, remark, eta);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Complaint #{c.number} · {formatDate(c.createdAt)}
          </div>
          <div className="mt-0.5 truncate text-base font-semibold">{c.category}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {collectorLabel} · Train {c.train}
            {c.station && <> · {c.station}</>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Highlighted status badge - top right */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${highlight.className}`}
          >
            <span className={`h-2 w-2 rounded-full ${highlight.dot}`} />
            {highlight.label}
          </span>
          <button
            onClick={() => setShowShare(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>
      </div>

      {showShare && (
        <ContactShareModal
          title={`Complaint #${c.number}`}
          message={shareMessage}
          onClose={() => setShowShare(false)}
        />
      )}

      <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>

      {/* Reason / what's happening / ETA section */}
      <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
        {!editing ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status Update
              </div>
              <p className="mt-1 text-sm">
                {c.adminRemark || (
                  <span className="italic text-muted-foreground">No update added yet.</span>
                )}
              </p>
              {c.expectedResolutionDate && (
                <p className="mt-1.5 text-xs font-semibold text-primary">
                  Expected resolution: {c.expectedResolutionDate}
                </p>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
            >
              {c.adminRemark ? "Edit" : "Add Update"}
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="What happened / what's being done..."
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            />
            <input
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="Expected resolution (e.g. 2-3 days, or a date)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setRemark(c.adminRemark ?? "");
                  setEta(c.expectedResolutionDate ?? "");
                  setEditing(false);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onStatusChange(c.id, "Under Review")}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          Review
        </button>
        <button
          onClick={() => onStatusChange(c.id, "Resolved")}
          className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
        >
          Resolve
        </button>
        <button
          onClick={() => onStatusChange(c.id, "Closed")}
          className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
