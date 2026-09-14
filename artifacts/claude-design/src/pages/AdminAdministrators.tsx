import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, ConfirmDialog } from "./Admin";
import { Icon } from "../components/ui";
import "../admin-administrators.css";

type Administrator = { clerkUserId: string, email: string, createdAt: string };
type PendingApproval = { email: string, createdAt: string };
type AuditLog = { id: string, actorEmail: string, targetEmail: string, action: string, createdAt: string };
type AdminAccessData = {
  administrators: Administrator[];
  pendingApprovals: PendingApproval[];
  audit: AuditLog[];
  currentUserId: string;
};

async function fetchAdmins(): Promise<AdminAccessData> {
  const res = await fetch("/api/admin/administrators");
  if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (!res.ok) throw new Error("Failed to load access data");
  return res.json();
}

async function addApproval(email: string) {
  const res = await fetch("/api/admin/administrators/approvals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to add approval");
  }
  return res.json();
}

async function cancelApproval(email: string) {
  const res = await fetch("/api/admin/administrators/approvals", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to cancel approval");
  }
  return res.json();
}

async function revokeAccess(clerkUserId: string) {
  const res = await fetch("/api/admin/administrators/access", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clerkUserId })
  });
  if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to revoke access");
  }
  return res.json();
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  const time = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(date);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return `${time}, ${day}`;
};

const formatAction = (action: string) => {
  const map: Record<string, string> = {
    bootstrap_claimed: "Claimed initial setup",
    approval_created: "Approved email",
    approval_cancelled: "Cancelled approval",
    access_granted: "Granted access",
    access_revoked: "Revoked access"
  };
  return map[action] || action;
};

export default function AdminAdministrators() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [listErrorMsg, setListErrorMsg] = useState("");
  
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{id: string, email: string} | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "administrators"],
    queryFn: fetchAdmins,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const addMut = useMutation({
    mutationFn: addApproval,
    onSuccess: () => {
      setNewEmail("");
      setErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to add approval");
    }
  });

  const cancelMut = useMutation({
    mutationFn: cancelApproval,
    onSuccess: () => {
      setConfirmCancel(null);
      setListErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
    },
    onError: (err: any) => {
      setListErrorMsg(err.message || "Failed to cancel approval");
      setConfirmCancel(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
    }
  });

  const revokeMut = useMutation({
    mutationFn: revokeAccess,
    onSuccess: (res, vars) => {
      setConfirmRevoke(null);
      setListErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
      if (data?.currentUserId === vars) {
        window.dispatchEvent(new Event("admin:unauthorized"));
      }
    },
    onError: (err: any) => {
      setListErrorMsg(err.message || "Failed to revoke access");
      setConfirmRevoke(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
    }
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    addMut.mutate(email);
  };

  if (isLoading) {
    return (
      <>
        <PageHeader eyebrow="Security" title="Administrators" />
        <div className="admin-content"><div className="admin-empty">Loading access data...</div></div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader eyebrow="Security" title="Administrators" />
        <div className="admin-content">
          <div className="admin-empty">
            Failed to load administrators. <br /><br />
            <button className="admin-button ghost" onClick={() => refetch()}>Try again</button>
          </div>
        </div>
      </>
    );
  }

  const isFinalAdmin = data.administrators.length <= 1;

  return (
    <>
      <PageHeader eyebrow="Security" title="Administrators" />
      <div className="admin-content admin-administrators-page">
        {listErrorMsg && (
          <div role="alert" className="admin-error-text" style={{ color: "var(--text-danger)", marginBottom: "16px", padding: "12px", background: "#fee2e2", borderRadius: "6px", fontSize: "0.875rem" }}>
            {listErrorMsg}
          </div>
        )}
        <section>
          <div className="admin-section-header">
            <h2>Add an administrator</h2>
            <p>Approve a team member's email to manage the catalogue.</p>
          </div>
          <div className="admin-instruction-text">
            <strong>Note:</strong> Approving an email creates no Clerk account and sends no email. The recipient must manually sign up or sign in to the published site using a verified primary email that exactly matches this approval.
          </div>
          
          <form className="admin-add-approval-card admin-add-approval-form" onSubmit={handleAdd}>
            <label>
              Email address
              <input 
                type="email" 
                value={newEmail} 
                onChange={e => setNewEmail(e.target.value)} 
                placeholder="colleague@example.com" 
                required 
                disabled={addMut.isPending}
              />
            </label>
            <button className="admin-button primary" type="submit" disabled={addMut.isPending || !newEmail.trim()}>
              {addMut.isPending ? "Approving..." : "Approve access"}
            </button>
          </form>
          {errorMsg && <div className="admin-error-text" style={{ color: "var(--text-danger)", marginTop: "-16px", marginBottom: "32px", fontSize: "0.875rem" }}>{errorMsg}</div>}
        </section>

        {data.pendingApprovals.length > 0 && (
          <section>
            <div className="admin-section-header">
              <h2>Pending approvals</h2>
              <p>These emails are approved but haven't signed in yet.</p>
            </div>
            <div className="admin-list-card">
              <table className="admin-list-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Approved on</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingApprovals.map(p => (
                    <tr key={p.email}>
                      <td><strong>{p.email}</strong></td>
                      <td>{formatDate(p.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button 
                          className="admin-action-button" 
                          onClick={() => setConfirmCancel(p.email)}
                        >
                          Cancel approval
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <div className="admin-section-header">
            <h2>Active administrators</h2>
            <p>Users who currently have access to manage the catalogue.</p>
          </div>
          <div className="admin-list-card">
            <table className="admin-list-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Granted on</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.administrators.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted, #6b7280)", padding: "32px 16px" }}>
                      No active administrator accounts found.<br />
                      <small style={{ display: "inline-block", marginTop: "8px" }}>
                        Development auto-sign-in bypasses access control and does not create an administrator record.
                      </small>
                    </td>
                  </tr>
                ) : (
                  data.administrators.map(a => {
                    const isSelf = a.clerkUserId === data.currentUserId;
                    const disableRevoke = isFinalAdmin;
                    
                    return (
                      <tr key={a.clerkUserId}>
                        <td><strong>{a.email}</strong> {isSelf && <span className="admin-only-mark">(You)</span>}</td>
                        <td>{formatDate(a.createdAt)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button 
                            className="admin-action-button" 
                            onClick={() => setConfirmRevoke({ id: a.clerkUserId, email: a.email })}
                            disabled={disableRevoke}
                            title={disableRevoke ? "Cannot remove the final administrator" : "Revoke access"}
                          >
                            Revoke access
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {data.audit && data.audit.length > 0 && (
          <section>
            <div className="admin-section-header">
              <h2>Audit log</h2>
              <p>Recent access changes.</p>
            </div>
            <div className="admin-audit-list">
              {data.audit.map(log => (
                <div key={log.id} className="admin-audit-item">
                  <div className="admin-audit-details">
                    <strong>{log.actorEmail}</strong>
                    <span>{formatAction(log.action)}</span>
                    <strong>{log.targetEmail}</strong>
                  </div>
                  <div className="admin-audit-time">{formatDate(log.createdAt)}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel approval?"
          body={`Are you sure you want to cancel the pending approval for ${confirmCancel}? They will not be able to sign in as an administrator.`}
          confirmLabel="Cancel approval"
          busyLabel="Cancelling..."
          busy={cancelMut.isPending}
          onCancel={() => setConfirmCancel(null)}
          onConfirm={() => cancelMut.mutate(confirmCancel)}
        />
      )}

      {confirmRevoke && (
        <ConfirmDialog
          title={confirmRevoke.id === data.currentUserId ? "Revoke your own access?" : "Revoke access?"}
          body={`Are you sure you want to revoke access for ${confirmRevoke.email}? ${confirmRevoke.id === data.currentUserId ? "You will be signed out immediately." : "They will be removed from the catalogue."}`}
          confirmLabel="Revoke access"
          busyLabel="Revoking..."
          busy={revokeMut.isPending}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => revokeMut.mutate(confirmRevoke.id)}
        />
      )}
    </>
  );
}
