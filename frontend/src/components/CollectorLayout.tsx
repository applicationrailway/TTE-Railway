import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Plus, FileText, ClipboardList, User, LogOut, Bell, ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Brand } from "./Brand";
import { toast } from "sonner";
import { useAuth } from "@/services/AuthContext";
import { isRestrictedDuty } from "@/lib/dutyStatus";

const ALL_TABS = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/entry/new", icon: Plus, label: "Entry" },
  { to: "/complaint/new", icon: FileText, label: "Complaint" },
  { to: "/entries", icon: ClipboardList, label: "History" },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

export function CollectorLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const restricted = isRestrictedDuty(profile?.dutyStatus, profile?.dutyStatusSetAt);
  const tabs = restricted ? ALL_TABS.filter((t) => t.to !== "/entry/new") : ALL_TABS;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !user) navigate({ to: "/" });
  }, [mounted, user, navigate]);

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-surface pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            {path !== "/home" && (
              <button
                onClick={() =>
                  window.history.length > 1 ? window.history.back() : navigate({ to: "/home" })
                }
                aria-label="Go back"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <Brand />
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              <Bell className="h-5 w-5" />
            </button>
            <button
              onClick={() => setConfirmLogout(true)}
              aria-label="Logout"
              className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted md:hidden"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => setConfirmLogout(true)}
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((t) => {
            const active = path === t.to || (t.to !== "/home" && path.startsWith(t.to));
            const Icon = t.icon;
            return (
             <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-1.5 py-3.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
              
                <div
                  className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
                    active ? "bg-primary-soft" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-elevated">
            <h3 className="text-lg font-semibold">Log out?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You'll need to sign in again to submit entries.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await logout();
                  toast.success("Logged out");
                  navigate({ to: "/" });
                }}
                className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
