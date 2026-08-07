import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllUsers,
  updateUserStatus,
  updateUserProfile,
  createTCUser,
  deleteUser,
  type CreateUserPayload,
  type UpdateUserPayload,
  type User,
} from "@/services/users";
import { AdminLayout } from "@/components/AdminLayout";
import { Eye, Pencil, Ban, CheckCircle2, Plus, X, Loader2, Save, Search, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Manage Users · Admin" }] }),
  component: AdminUsersPage,
});

const BASES = ["NGP", "NITR", "G", "RJN", "NIR", "GRG", "DGG"];

function emptyForm(): CreateUserPayload {
  return {
    name: "",
    email: "",
    password: "",
    pfNo: "",
    mobile: "",
    base: "NGP",
    division: "NGP",
    tteLobbyId: "",
    role: "tc",
  };
}

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: fetchAllUsers });
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const collectors = users.filter(
    (u) => u.role?.toLowerCase() === "tc" || u.role?.toLowerCase() === "collector"
  );

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.pfNo || u.empId || "").toLowerCase().includes(q) ||
      u.base?.toLowerCase().includes(q) ||
      u.mobile?.toLowerCase().includes(q)
    );
  });

  async function toggleStatus(u: (typeof users)[number]) {
    const next = u.status === "active" ? "disabled" : "active";
    try {
      await updateUserStatus(u.id, next);
      toast.success(`${u.name} ${next === "active" ? "enabled" : "disabled"}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      toast.success(`${deletingUser.name} deleted`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDeletingUser(null);
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  function setField<K extends keyof CreateUserPayload>(k: K, v: CreateUserPayload[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.pfNo.trim()) {
      toast.error("Name, Email, Password and PF No. are required");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    try {
      await createTCUser(form);
      toast.success(`TC account created for ${form.name}`);
      setShowAdd(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create user";
      toast.error(msg.includes("email-already-in-use") ? "Email already registered" : msg);
    } finally {
      setCreating(false);
    }
  }
  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-sm text-muted-foreground">{collectors.length} collectors registered.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStatusSheet(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <Table2 className="h-4 w-4" /> Status Sheet
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
          >
            <Plus className="h-4 w-4" /> Add TC
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, PF no., base, or phone…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">PF No.</th>
              <th className="px-4 py-3">Base</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{u.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-sm">{u.pfNo || u.empId || "—"}</td>
                <td className="px-4 py-3">
                  <span className="chip">{u.base}</span>
                </td>
                <td className="px-4 py-3">{u.mobile || "—"}</td>
                <td className="px-4 py-3">
                  {u.status === "active" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn onClick={() => setViewingUser(u)} label="View">
                      <Eye className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn onClick={() => setEditingUser(u)} label="Edit">
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      onClick={() => toggleStatus(u)}
                      label={u.status === "active" ? "Disable" : "Enable"}
                      tone={u.status === "active" ? "destructive" : "success"}
                    >
                      <Ban className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn onClick={() => setDeletingUser(u)} label="Delete" tone="destructive">
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
               </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add TC Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-elevated">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add New TC</h2>
              <button onClick={() => setShowAdd(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Full Name *">
                  <input
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. S G SATHWANE"
                    className="field-input"
                  />
                </FormField>
                <FormField label="PF No. *">
                  <input
                    value={form.pfNo}
                    onChange={(e) => setField("pfNo", e.target.value)}
                    placeholder="e.g. 39500722678"
                    className="field-input font-mono"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Mobile No.">
                  <input
                    value={form.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
                    inputMode="numeric"
                    placeholder="10-digit number"
                    className="field-input"
                  />
                </FormField>
                <FormField label="Base">
                  <select
                    value={form.base}
                    onChange={(e) => setField("base", e.target.value)}
                    className="field-input"
                  >
                    {BASES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Email *">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="tc@railway.gov.in"
                  className="field-input"
                />
              </FormField>

              <FormField label="Password * (min 6 chars)">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Set a secure password"
                  className="field-input"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Division">
                  <input
                    value={form.division ?? ""}
                    onChange={(e) => setField("division", e.target.value)}
                    placeholder="e.g. NGP"
                    className="field-input"
                  />
                </FormField>
                <FormField label="TTE Lobby ID">
                  <input
                    value={form.tteLobbyId ?? ""}
                    onChange={(e) => setField("tteLobbyId", e.target.value)}
                    placeholder="e.g. LOBBY-01"
                    className="field-input"
                  />
                </FormField>
              </div>

              <FormField label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setField("role", e.target.value as "tc" | "admin")}
                  className="field-input"
                >
                  <option value="tc">TC (Collector)</option>
                  <option value="admin">Admin</option>
                </select>
              </FormField>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? "Creating…" : "Create TC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingUser && (
        <ViewUserModal user={viewingUser} onClose={() => setViewingUser(null)} />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
        />
      )}

      {/* Status Sheet Modal */}
      {showStatusSheet && (
        <StatusSheetModal users={users} onClose={() => setShowStatusSheet(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeletingUser(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-elevated">
            <h2 className="text-lg font-bold">Delete {deletingUser.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes their login and profile. Their past entries will stay in Daily Entries, but they will no longer be able to sign in. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function ViewUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{user.name}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="PF No." value={user.pfNo || user.empId || "—"} />
          <DetailRow label="Mobile" value={user.mobile || "—"} />
          <DetailRow label="Base" value={user.base} />
          <DetailRow label="Division" value={user.division || "—"} />
          <DetailRow label="TTE Lobby ID" value={user.tteLobbyId || "—"} />
          <DetailRow label="Role" value={user.role === "admin" ? "Admin" : "TC (Collector)"} />
          <DetailRow label="Status" value={user.status === "active" ? "Active" : "Disabled"} />
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpdateUserPayload>({
    name: user.name,
    pfNo: user.pfNo || user.empId || "",
    mobile: user.mobile,
    base: user.base,
    division: user.division ?? "",
    tteLobbyId: user.tteLobbyId ?? "",
    role: user.role,
  });
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof UpdateUserPayload>(k: K, v: UpdateUserPayload[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.pfNo.trim()) {
      toast.error("Name and PF No. are required");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.id, form);
      toast.success("User updated");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to update user");
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
          <h2 className="text-lg font-bold">Edit {user.name}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Full Name *">
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="field-input"
              />
            </FormField>
            <FormField label="PF No. *">
              <input
                value={form.pfNo}
                onChange={(e) => setField("pfNo", e.target.value)}
                className="field-input font-mono"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mobile No.">
              <input
                value={form.mobile}
                onChange={(e) => setField("mobile", e.target.value)}
                inputMode="numeric"
                className="field-input"
              />
            </FormField>
            <FormField label="Base">
              <select
                value={form.base}
                onChange={(e) => setField("base", e.target.value)}
                className="field-input"
              >
                {BASES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </FormField>
          </div>

         <div className="grid grid-cols-2 gap-3">
            <FormField label="Division">
              <input
                value={form.division ?? ""}
                onChange={(e) => setField("division", e.target.value)}
                placeholder="e.g. NGP"
                className="field-input"
              />
            </FormField>
            <FormField label="TTE Lobby ID">
              <input
                value={form.tteLobbyId ?? ""}
                onChange={(e) => setField("tteLobbyId", e.target.value)}
                placeholder="e.g. LOBBY-01"
                className="field-input"
              />
            </FormField>
          </div>

          <FormField label="Role">
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value as "tc" | "admin")}
              className="field-input"
            >
              <option value="tc">TC (Collector)</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>

          <p className="text-xs text-muted-foreground">
            Email and password cannot be changed here.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusSheetModal({ users, onClose }: { users: User[]; onClose: () => void }) {
  const [search, setSearch] = useState("");

  const collectors = users
    .filter((u) => !search.trim() || u.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">TC Status Sheet</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search TC name…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {collectors.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    {u.status === "active" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                        Disabled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {collectors.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No TCs match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
        >
          Close
        </button>
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

function IconBtn({
  children,
  onClick,
  label,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  tone?: "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive hover:bg-destructive/10"
      : tone === "success"
        ? "text-success hover:bg-success/10"
        : "text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${toneClass}`}
    >
      {children}
    </button>
  );
}