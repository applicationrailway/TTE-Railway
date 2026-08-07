import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectorLayout } from "@/components/CollectorLayout";
import { useAuth } from "@/services/AuthContext";
import { formatDate } from "@/lib/format";
import { Mail, Phone, MapPin, BadgeCheck, Calendar, Pencil, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · TC System" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { profile, loading: authLoading, logout } = useAuth();
  if (authLoading || !profile) return null;
  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <CollectorLayout>
      <h1 className="mb-5 text-2xl font-bold">Profile</h1>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="bg-primary p-6 text-primary-foreground">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-bold">{profile.name}</div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                <BadgeCheck className="h-3.5 w-3.5" /> {profile.employee_id ?? profile.mobile}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Row icon={<Mail className="h-4 w-4" />} label="Email">
            {profile.email}
          </Row>
          <Row icon={<Phone className="h-4 w-4" />} label="Mobile">
            {profile.mobile}
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Base">
            {profile.base} Division
          </Row>
          <Row icon={<Calendar className="h-4 w-4" />} label="Joining Date">
            {profile.joining ? formatDate(profile.joining) : "—"}
          </Row>
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            <Pencil className="h-4 w-4" /> Edit profile
          </button>
          <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted">
            <KeyRound className="h-4 w-4" /> Change password
          </button>
          <button
            onClick={async () => {
              await logout();
              toast.success("Logged out successfully");
              navigate({ to: "/" });
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive py-3 text-sm font-semibold hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>
    </CollectorLayout>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{children}</div>
    </div>
  );
}
