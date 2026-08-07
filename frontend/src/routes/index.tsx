import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Train, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "@/services/auth";
import { useAuth } from "@/services/AuthContext";
import { saveDraftEntry, submitEntries, type FineCategory, type SquadName } from "@/services/entries";
import { updateDutyStatus } from "@/services/useProfile";
import { isDutyLocked, WORKING_STATUS } from "@/lib/dutyStatus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Sign in · Indian Railways TC System" }],
  }),
  component: LoginPage,
});

const TRAIN_STATUSES = ["REST", "LAP", "CL", "SCL", "CCL", "LEAVE", "SICK", "ML", "STN"];

function canEditEntry(e: Entry): boolean {
  if (e.status !== "submitted") return false;
  if (e.edited) return false;
  if (TRAIN_STATUSES.includes(e.trainNumber.toUpperCase().trim())) return false; // status-only entries aren't editable
  return true;
}
function emptyFine(): FineCategory { return { cases: 0, amount: 0 }; }

function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("collector@railway.gov.in");
  const [password, setPassword] = useState("collector123");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const [showDutyModal, setShowDutyModal] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (authLoading || !user || !profile) return;

    if (profile.role === "admin") {
      navigate({ to: "/admin" });
      return;
    }

    if (checkedToday) return; // already handled this session

    const locked = isDutyLocked(profile.dutyStatusSetAt);
    if (locked) {
      // Status was already picked within the last 24 hours — don't show the modal again
      setCheckedToday(true);
      if (profile.dutyStatus === WORKING_STATUS) {
        navigate({ to: "/home" });
      } else {
        toast.message(
          `You're marked as ${profile.dutyStatus} — dashboard access is limited until your status resets.`,
        );
        navigate({ to: "/entries" });
      }
      return;
    }

    setShowDutyModal(true);
    setCheckedToday(true);
  }, [authLoading, user, profile, navigate, checkedToday]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Signed in successfully");
    } catch (error) {
      toast.error("Invalid credentials. Try collector@railway.gov.in or admin@railway.gov.in");
    } finally {
      setLoading(false);
    }
  }

  async function submitStatusOnly(status: string) {
    if (!user || !profile) return;
    try {
      const id = await saveDraftEntry({
        collectorId: user.uid,
        collectorName: profile.name,
        collectorBase: profile.base,
        pfNo: profile.pfNo ?? "",
        date: today,
        trainNumber: status,
        workingIn: "stn",
        squadName: "" as SquadName,
        A: emptyFine(), B: emptyFine(), C: emptyFine(),
        D: emptyFine(), E: emptyFine(), smoking: emptyFine(),
        totalCases: 0,
        totalAmount: 0,
        status: "draft",
      });
      await submitEntries([id]);
      toast.success(`Marked as ${status} for today`);
      navigate({ to: "/entries" });
    } catch {
      toast.error("Failed to save status — please retry");
    }
  }

  if (authLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-soft via-surface to-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 h-20 w-20 overflow-hidden rounded-2xl shadow-elevated">
  <img
    src="/railway-logo.jpeg"
    alt="Indian Railways Logo"
    className="h-full w-full object-contain"
  />
</div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Indian Railways
          </div>
          {/* <h1 className="mt-1 text-2xl font-bold">TC Daily Earning System</h1> */}
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to record earnings & file complaints
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Email
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="you@railway.gov.in"
                required
              />
            </div>
          </label>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Password
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className="mb-5 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-[var(--color-primary)]"
              />
              Remember me
            </label>
            <Link to="/" className="font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-card transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {/* <div className="mt-5 rounded-xl bg-primary-soft p-3 text-xs text-primary">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" /> Demo accounts
            </div>
            <div>
              Collector: <span className="font-mono">collector@railway.gov.in</span>
            </div>
            <div>
              Admin: <span className="font-mono">admin@railway.gov.in</span>
            </div>
          </div> */}
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Authorized personnel only · Government of India
        </p>
      </div>

   {showDutyModal && (
        <DutyStatusModal
          onWorking={async () => {
            if (user) {
              try { await updateDutyStatus(user.uid, WORKING_STATUS); } catch { /* non-fatal */ }
            }
            setShowDutyModal(false);
            navigate({ to: "/home" });
          }}
          onSelectStatus={async (s) => {
            if (user) {
              try { await updateDutyStatus(user.uid, s); } catch { /* non-fatal */ }
            }
            setShowDutyModal(false);
            submitStatusOnly(s);
          }}
        />
      )}
    </div>
  );
}

function DutyStatusModal({
  onSelectStatus,
  onWorking,
}: {
  onSelectStatus: (status: string) => void;
  onWorking: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-elevated">
        <h3 className="mb-1 text-base font-bold">Today's Duty Status</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Are you working a train today, or on leave/rest?
        </p>
        <button
          onClick={onWorking}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          <Train className="h-4 w-4" /> I'm working a train today
        </button>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Or select your status
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TRAIN_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onSelectStatus(s)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}