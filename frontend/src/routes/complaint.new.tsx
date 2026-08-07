import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { CollectorLayout } from "@/components/CollectorLayout";
import { useAuth } from "@/services/AuthContext";
import { submitComplaint } from "@/services/complaints";
import { useState } from "react";
import { Send, CheckCircle2, AlertTriangle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ContactShareModal } from "@/components/ContactShareModal";
export const Route = createFileRoute("/complaint/new")({
  head: () => ({ meta: [{ title: "Submit Complaint · TC System" }] }),
  component: NewComplaintPage,
});

const CATEGORIES = [
  "Electrical Issue",
  "Cleanliness",
  "Catering",
  "Security",
  "Passenger Misconduct",
  "Coach Damage",
  "Other",
];

const PRIORITIES = ["Low", "Medium", "High"] as const;

type ComplaintPriority = (typeof PRIORITIES)[number];

function NewComplaintPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [train, setTrain] = useState("");
  const [station, setStation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority>("Medium");
  const [done, setDone] = useState<{ number: number } | null>(null);
  const [showShare, setShowShare] = useState(false);

  if (authLoading || !user || !profile) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    if (!train.trim() || !description.trim()) {
      toast.error("Please fill required fields");
      return;
    }
    const number = await submitComplaint({
      collectorId: user.uid,
      collectorName: profile.name,
      collectorBase: profile.base,
      category,
      train: train.trim(),
      station: station.trim(),
      description: description.trim(),
      priority,
    });
    setDone({ number });
  }

  if (done) {
    return (
      <CollectorLayout>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-xl font-bold">Complaint Submitted</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your complaint has been registered and forwarded to the division office.
          </p>
          <div className="mt-5 rounded-xl bg-primary-soft p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              Reference Number
            </div>
            <div className="mt-1 text-2xl font-bold text-primary">#{done.number}</div>
          </div>
         <button
            onClick={() => setShowShare(true)}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary-soft text-sm font-semibold text-primary"
          >
            <Share2 className="h-4 w-4" /> Send to Commercial Control / Officer
          </button>

          <div className="mt-3 flex gap-2">
            <Link
              to="/complaints"
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted"
            >
              View history
            </Link>
            <button
              onClick={() => navigate({ to: "/home" })}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Back to home
            </button>
          </div>
        </div>

        {showShare && (
          <ContactShareModal
            title={`Complaint #${done.number}`}
            message={
              `Complaint #${done.number} — ${category}\n` +
              `Train: ${train}${station ? ` · Station: ${station}` : ""}\n` +
              `Priority: ${priority}\n\n` +
              `${description}`
            }
            onClose={() => setShowShare(false)}
          />
        )}
      </CollectorLayout>
    );
  }

  return (
    <CollectorLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Submit Complaint</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Provide details — the division office will review within 24 hours.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-5"
      >
        <div>
          <Label required>Complaint Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label required>Train Number</Label>
            <input
              value={train}
              onChange={(e) => setTrain(e.target.value)}
              placeholder="e.g. 22973"
              inputMode="numeric"
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              required
            />
          </div>
          <div>
            <Label>Station</Label>
            <input
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="e.g. NGP"
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div>
          <Label required>Description</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe the issue clearly…"
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            required
          />
        </div>

        <div>
          <Label>Priority</Label>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((p) => {
              const active = p === priority;
              const tone = p === "High" ? "destructive" : p === "Medium" ? "warning" : "primary";
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
                    active
                      ? tone === "destructive"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : tone === "warning"
                          ? "border-warning bg-warning/15 text-warning-foreground"
                          : "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p === "High" && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-card"
        >
          <Send className="h-4 w-4" /> Submit Complaint
        </button>
      </form>
    </CollectorLayout>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children} {required && <span className="text-destructive">*</span>}
    </div>
  );
}
