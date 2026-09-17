import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog, PageHeader } from "./Admin";
import "../admin-administrators.css";

type Administrator = {
  clerkUserId: string;
  email: string;
  role: "admin" | "superadmin";
  disabledAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};

type AuditLog = {
  id: number;
  actorEmail: string;
  targetEmail: string;
  action: string;
  createdAt: string;
};

type AdminAccessData = {
  administrators: Administrator[];
  audit: AuditLog[];
  currentUserId: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new Event("admin:unauthorized"));
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The administrator account could not be changed.");
  return body;
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const actionLabels: Record<string, string> = {
  superadmin_bootstrapped: "created the Superadmin account",
  account_created: "created an administrator",
  account_disabled: "disabled an administrator",
  account_restored: "restored an administrator",
  temporary_password_reset_requested: "issued a new temporary password for",
};

function TemporaryPasswordCard({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  };
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section className="admin-dialog admin-temporary-password" role="dialog" aria-modal="true" aria-labelledby="temporary-password-title">
        <h2 id="temporary-password-title">Temporary password</h2>
        <p>Give this password to <strong>{email}</strong>. It is shown only once and must be changed at first login.</p>
        <code>{password}</code>
        <div className="admin-dialog-actions">
          <button className="admin-button primary" type="button" onClick={copy}>{copied ? "Copied" : "Copy password"}</button>
          <button className="admin-button ghost" type="button" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}

export default function AdminAdministrators() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [temporary, setTemporary] = useState<{ email: string; password: string } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Administrator | null>(null);
  const [resetTarget, setResetTarget] = useState<Administrator | null>(null);

  const admins = useQuery({
    queryKey: ["admin", "administrators"],
    queryFn: () => request<AdminAccessData>("/api/admin/administrators"),
    refetchOnWindowFocus: true,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });

  const createMutation = useMutation({
    mutationFn: (email: string) => request<{ temporaryPassword: string }>("/api/admin/administrators", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
    onSuccess: (result, email) => {
      setTemporary({ email, password: result.temporaryPassword });
      setNewEmail("");
      setError("");
      refresh();
    },
    onError: (caught: Error) => setError(caught.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ account, disabled }: { account: Administrator; disabled: boolean }) =>
      request(`/api/admin/administrators/${encodeURIComponent(account.clerkUserId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ disabled }),
      }),
    onSuccess: () => {
      setStatusTarget(null);
      setError("");
      refresh();
    },
    onError: (caught: Error) => {
      setStatusTarget(null);
      setError(caught.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (account: Administrator) =>
      request<{ temporaryPassword: string }>(
        `/api/admin/administrators/${encodeURIComponent(account.clerkUserId)}/temporary-password`,
        { method: "POST" },
      ),
    onSuccess: (result, account) => {
      setResetTarget(null);
      setTemporary({ email: account.email, password: result.temporaryPassword });
      setError("");
      refresh();
    },
    onError: (caught: Error) => {
      setResetTarget(null);
      setError(caught.message);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const email = newEmail.trim();
    if (email) createMutation.mutate(email);
  };

  return (
    <>
      <PageHeader eyebrow="Security" title="Administrators" />
      <div className="admin-content admin-administrators-page">
        {error && <div className="admin-error-text" role="alert">{error}</div>}

        <section>
          <div className="admin-section-header">
            <h2>Add an administrator</h2>
            <p>Create an account with a one-time temporary password.</p>
          </div>
          <form className="admin-add-approval-card admin-add-approval-form" onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="colleague@example.com"
                required
                disabled={createMutation.isPending}
              />
            </label>
            <button className="admin-button primary" type="submit" disabled={!newEmail.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create administrator"}
            </button>
          </form>
        </section>

        <section>
          <div className="admin-section-header">
            <h2>Administrator accounts</h2>
            <p>Only the Superadmin can create, disable, restore, or reset accounts.</p>
          </div>
          <div className="admin-list-card">
            {admins.isLoading ? (
              <div className="admin-empty">Loading administrator accounts…</div>
            ) : admins.isError || !admins.data ? (
              <div className="admin-empty">Could not load administrator accounts. <button className="admin-button ghost" onClick={() => admins.refetch()}>Try again</button></div>
            ) : (
              <table className="admin-list-table">
                <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th /></tr></thead>
                <tbody>
                  {admins.data.administrators.map((account) => {
                    const protectedAccount = account.role === "superadmin";
                    return (
                      <tr key={account.clerkUserId}>
                        <td><strong>{account.email}</strong>{account.clerkUserId === admins.data.currentUserId && <span className="admin-only-mark"> (You)</span>}</td>
                        <td>{protectedAccount ? "Superadmin" : "Administrator"}</td>
                        <td>{account.disabledAt ? "Disabled" : account.mustChangePassword ? "Temporary password" : "Active"}</td>
                        <td>{formatDate(account.createdAt)}</td>
                        <td className="admin-account-actions">
                          {!protectedAccount && (
                            <>
                              <button className="admin-action-button" type="button" onClick={() => setResetTarget(account)}>New temporary password</button>
                              <button className="admin-action-button" type="button" onClick={() => setStatusTarget(account)}>{account.disabledAt ? "Restore" : "Disable"}</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {admins.data?.audit?.length ? (
          <section>
            <div className="admin-section-header"><h2>Access history</h2><p>Recent administrator account changes.</p></div>
            <div className="admin-audit-list">
              {admins.data.audit.map((item) => (
                <div className="admin-audit-item" key={item.id}>
                  <div className="admin-audit-details"><strong>{item.actorEmail}</strong><span>{actionLabels[item.action] || item.action}</span><strong>{item.targetEmail}</strong></div>
                  <div className="admin-audit-time">{formatDate(item.createdAt)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {temporary && <TemporaryPasswordCard {...temporary} onClose={() => setTemporary(null)} />}
      {statusTarget && (
        <ConfirmDialog
          title={statusTarget.disabledAt ? "Restore administrator?" : "Disable administrator?"}
          body={statusTarget.disabledAt ? `${statusTarget.email} will be able to log in again.` : `${statusTarget.email} will be signed out and blocked from the admin area.`}
          confirmLabel={statusTarget.disabledAt ? "Restore" : "Disable"}
          busyLabel="Saving…"
          busy={statusMutation.isPending}
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => statusMutation.mutate({ account: statusTarget, disabled: !statusTarget.disabledAt })}
        />
      )}
      {resetTarget && (
        <ConfirmDialog
          title="Issue a new temporary password?"
          body={`${resetTarget.email} will be signed out. Their current password will stop working, and they must change the new temporary password at next login.`}
          confirmLabel="Issue password"
          busyLabel="Creating…"
          busy={resetMutation.isPending}
          onCancel={() => setResetTarget(null)}
          onConfirm={() => resetMutation.mutate(resetTarget)}
        />
      )}
    </>
  );
}