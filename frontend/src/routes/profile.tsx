import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectorLayout } from "@/components/CollectorLayout";
import { useAuth } from "@/services/AuthContext";
import { updateOwnProfile } from "@/services/useProfile";
import { formatDate } from "@/lib/format";
import {
  Mail, Phone, MapPin, BadgeCheck, Calendar, Pencil, KeyRound, LogOut,
  IdCard, Building2, X, Loader2, Save,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

const BASES = ["NGP", "NITR", "G", "RJN", "NIR", "GRG", "DGG"];

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · TC System" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, logout } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
          <Row icon={<IdCard className="h-4 w-4" />} label="PF No.">
            {profile.pfNo || profile.employee_id || "—"}
          </Row>
          <Row icon={<BadgeCheck className="h-4 w-4" />} label="TTE Lobby ID">
            {profile.tteLobbyId || "—"}
          </Row>
          <Row icon={<Building2 className="h-4 w-4" />} label="Division">
            {profile.division || "—"}
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Base Station">
            {profile.base}
          </Row>
          <Row icon={<Mail className="h-4 w-4" />} label="Email">
            {profile.email}
          </Row>
          <Row icon={<Phone className="h-4 w-4" />} label="Mobile">
            {profile.mobile || "—"}
          </Row>
          <Row icon={<Calendar className="h-4 w-4" />} label="Joining Date">
            {profile.joining ? formatDate(profile.joining) : "—"}
          </Row>
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row">
          <button
            onClick={() => setShowEdit(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            <Pencil className="h-4 w-4" /> Edit profile
          </button>
          <button
            onClick={() => setShowPassword(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted"
          >
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

      {showEdit && (
        <EditProfileModal onClose={() => setShowEdit(false)} />
      )}
      {showPassword && user?.email && (
        <ChangePasswordModal email={user.email} onClose={() => setShowPassword(false)} />
      )}
    </CollectorLayout>
  );
}

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [mobile, setMobile] = useState(profile?.mobile ?? "");
  const [base, setBase] = useState(profile?.base ?? "NGP");
  const [pfNo, setPfNo] = useState(profile?.pfNo ?? "");
  const [division, setDivision] = useState(profile?.division ?? "");
  const [tteLobbyId, setTteLobbyId] = useState(profile?.tteLobbyId ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateOwnProfile(user.uid, {
        name: name.trim(),
        mobile: mobile.trim(),
        base,
        pfNo: pfNo.trim(),
        division: division.trim(),
        tteLobbyId: tteLobbyId.trim(),
      });
      toast.success("Profile updated");
      onClose();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Profile</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <FormField label="Full Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mobile No.">
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="numeric"
                className="field-input"
              />
            </FormField>
            <FormField label="Base">
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="field-input"
              >
                {BASES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="PF No.">
              <input
                value={pfNo}
                onChange={(e) => setPfNo(e.target.value)}
                className="field-input font-mono"
              />
            </FormField>
            <FormField label="TTE Lobby ID">
              <input
                value={tteLobbyId}
                onChange={(e) => setTteLobbyId(e.target.value)}
                className="field-input"
              />
            </FormField>
          </div>

          <FormField label="Division">
            <input
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="e.g. NGP"
              className="field-input"
            />
          </FormField>
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
    </div>
  );
}

function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    if (!user) return;
    if (!currentPassword || !newPassword) {
      toast.error("Please fill all fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success("Password changed successfully");
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Change Password</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <FormField label="Current Password">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="field-input"
            />
          </FormField>
          <FormField label="New Password (min 6 chars)">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="field-input"
            />
          </FormField>
          <FormField label="Confirm New Password">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field-input"
            />
          </FormField>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleChange}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
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
