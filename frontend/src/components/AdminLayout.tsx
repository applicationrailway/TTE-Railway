import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  MessageSquareWarning,
  Users,
  BarChart3,
  TrendingUp,
  Table,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/services/AuthContext";
import { Brand } from "./Brand";
import { toast } from "sonner";

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean };
const nav: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/entries", icon: ClipboardList, label: "Daily Entries" },
  { to: "/admin/complaints", icon: MessageSquareWarning, label: "Complaints" },
  { to: "/admin/users", icon: Users, label: "Manage Users" },
  { to: "/admin/analysis", icon: BarChart3, label: "TC Analysis" },
   { to: "/admin/growth", icon: TrendingUp, label: "Admin Analysis" },
   { to: "/admin/sheet", icon: Table, label: "Sheet" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile: user, loading, logout } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !loading && (!user || user.role !== "admin")) navigate({ to: "/" });
  }, [mounted, loading, user, navigate]);
  useEffect(() => setOpen(false), [path]);

  if (loading || !user || user.role !== "admin") return null;

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-border bg-background transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-19 items-center justify-between border-b border-border px-5">
          <Brand subtitle="Admin Console" />
          <button
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to as "/admin"}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
       <div className="border-t border-border p-3">
          <button
            onClick={async () => {
              await logout();
              toast.success("Logged out");
              navigate({ to: "/" });
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
        />
      )}

    <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="flex h-19 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <button
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Admin Console
            </div>
            <div className="text-base font-semibold">Welcome back, {user.name}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-muted-foreground">
                {user.empId} · {user.base}
              </div>
            
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {(user.name || "User")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>

    
  );
}
