import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CollectorLayout } from "@/components/CollectorLayout";
import { useAuth } from "@/services/AuthContext";
import { fetchMyComplaints } from "@/services/complaints";
import { formatDate, type ComplaintStatus } from "@/lib/format";
import { FileText, Plus, Train } from "lucide-react";

export const Route = createFileRoute("/complaints")({
  head: () => ({ meta: [{ title: "Complaint History · TC System" }] }),
  component: ComplaintsPage,
});

const STATUS_STYLE: Record<ComplaintStatus, string> = {
  Pending: "bg-warning/20 text-warning-foreground",
  "Under Review": "bg-primary-soft text-primary",
  Resolved: "bg-success/15 text-success",
  Closed: "bg-muted text-muted-foreground",
};

function ComplaintsPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: complaints = [] } = useQuery({
    queryKey: ["complaints", user?.uid],
    queryFn: () => fetchMyComplaints(user!.uid),
    enabled: !!user,
  });

  if (authLoading || !user) return null;

  return (
    <CollectorLayout>
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Complaint History</h1>
          <p className="text-sm text-muted-foreground">{complaints.length} complaints filed</p>
        </div>
        <Link
          to="/complaint/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          <Plus className="h-4 w-4" /> New
        </Link>
      </header>

      {complaints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">No complaints yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">All quiet on your routes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Complaint #{c.number}
                  </div>
                  <div className="mt-1 truncate text-base font-semibold">{c.category}</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Train className="h-3.5 w-3.5" /> Train {c.train}
                    {c.station && <> · {c.station}</>}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[c.status]}`}
                >
                  {c.status}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Submitted {formatDate(c.createdAt)}</span>
                <button className="font-semibold text-primary hover:underline">Open →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollectorLayout>
  );
}
