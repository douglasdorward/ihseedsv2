import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminRedirectsQueryKey,
  useCommitRedirectImport,
  useDeleteAdminRedirect,
  useDryRunRedirectImport,
  useListAdminRedirects,
  type AdminRedirect,
  type RedirectImportReport,
} from "@workspace/api-client-react";
import { Icon } from "../components/ui";
import { navigate } from "../router";
import { ConfirmDialog, PageHeader } from "./Admin";
import "../admin-redirects.css";

const PAGE_SIZE = 100;
const ISSUES_SHOWN = 50;

const SOURCE_LABELS: Record<AdminRedirect["source"], string> = {
  uploaded: "Uploaded",
  catalogue: "Catalogue",
  product: "Product editor",
  article: "Blog article",
};

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  if (error instanceof Error) return error.message.replace(/^HTTP \d+ [^:]+:\s*/, "");
  return fallback;
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const dryRun = useDryRunRedirectImport();
  const commit = useCommitRedirectImport();
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("");
  const [report, setReport] = useState<RedirectImportReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCsvText("");
    setFilename("");
    setReport(null);
    setError("");
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setCsvText(await file.text());
    setReport(null);
    setError("");
  };

  const handleDryRun = async () => {
    setBusy(true);
    setError("");
    try {
      setReport(await dryRun.mutateAsync({ data: { csvText } }));
    } catch (caught) {
      setError(errorMessage(caught, "Could not check that CSV."));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      await commit.mutateAsync({ data: { csvText, token: report.token } });
      await queryClient.invalidateQueries({ queryKey: getListAdminRedirectsQueryKey() });
      reset();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, "Could not upload that CSV."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const changes = report ? report.created + report.updated : 0;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={close}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="redirect-import-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="redirect-import-title">Upload redirects</h2>
        <p>
          Upload a CSV with two columns, <code>from_path</code> and <code>to_path</code>, one redirect per row.
          Use paths such as <code>/old-page</code> or full irwinhunter.com.au addresses. Query strings on the old
          address cannot be matched. An old path that already has an uploaded redirect is changed to the new
          destination. Up to 5,000 rows at a time.
        </p>
        {!report ? (
          <div className="admin-import-file-row">
            <input type="file" accept=".csv,text/csv" data-testid="redirect-import-file" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }} />
            <button className="admin-button outline small" type="button" onClick={() => { void handleDryRun(); }} disabled={!csvText || busy} data-testid="redirect-dry-run-btn">
              {busy ? "Checking…" : "Check file"}
            </button>
          </div>
        ) : (
          <div className="admin-import-report" data-testid="redirect-import-report">
            <p>
              <strong>{filename || "CSV"}:</strong> {report.created} new, {report.updated} changed, {report.unchanged} already in place, {report.skipped} blank rows skipped.
            </p>
            {report.issues.length > 0 && (
              <>
                <p className="admin-redirect-issue-heading">
                  {report.issues.length} {report.issues.length === 1 ? "problem" : "problems"} to fix before uploading:
                </p>
                <ul>
                  {report.issues.slice(0, ISSUES_SHOWN).map((issue, index) => (
                    <li key={`${issue.row}-${issue.column}-${index}`} className="admin-redirect-issue">
                      Row {issue.row} {issue.column}: {issue.problem}
                    </li>
                  ))}
                  {report.issues.length > ISSUES_SHOWN && <li>…and {report.issues.length - ISSUES_SHOWN} more</li>}
                </ul>
              </>
            )}
            {report.issues.length === 0 && report.plannedChanges.length > 0 && (
              <ul>{report.plannedChanges.map((change, index) => <li key={`${index}-${change}`}>{change}</li>)}</ul>
            )}
            {report.issues.length === 0 && changes === 0 && <p>Nothing to change. Every redirect in this file is already in place.</p>}
          </div>
        )}
        {error && <p className="admin-inline-field-error">{error}</p>}
        <div className="admin-import-actions">
          <button className="admin-button ghost" type="button" onClick={close} disabled={busy}>Cancel</button>
          {report && report.issues.length > 0 && (
            <button className="admin-button outline" type="button" onClick={reset} disabled={busy}>Choose another file</button>
          )}
          {report && report.issues.length === 0 && changes > 0 && (
            <button className="admin-button primary" type="button" onClick={() => { void handleCommit(); }} disabled={busy} data-testid="redirect-commit-import-btn">
              {busy ? "Uploading…" : `Upload ${changes} ${changes === 1 ? "redirect" : "redirects"}`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminRedirects() {
  const queryClient = useQueryClient();
  const { data: redirects = [], isLoading, error } = useListAdminRedirects();
  const deleteRedirect = useDeleteAdminRedirect();
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<AdminRedirect | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return redirects;
    return redirects.filter((item) =>
      item.fromPath.toLowerCase().includes(needle) || item.toPath.toLowerCase().includes(needle));
  }, [redirects, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [query]);
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1); }, [page, pageCount]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError("");
    try {
      await deleteRedirect.mutateAsync({ id: pendingDelete.id });
      await queryClient.invalidateQueries({ queryKey: getListAdminRedirectsQueryKey() });
    } catch (caught) {
      setDeleteError(errorMessage(caught, "Could not delete that redirect."));
    } finally {
      setPendingDelete(null);
    }
  };

  const uploadedCount = redirects.filter((item) => item.source === "uploaded").length;

  return (
    <>
      <PageHeader
        eyebrow="Site settings"
        title={<>Legacy URL <strong>redirects</strong></>}
        action={(
          <div className="admin-redirect-actions">
            <button className="admin-button ghost" type="button" onClick={() => navigate("/admin/site-settings")}>Back to site settings</button>
            <button className="admin-button outline" type="button" onClick={() => { window.location.href = "/api/admin/redirects/import/template"; }}>Download template</button>
            <button className="admin-button primary" type="button" onClick={() => setImportOpen(true)} data-testid="redirect-import-btn">
              <Icon name="plus" size={18} /> Upload redirects
            </button>
          </div>
        )}
      />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20} />
          <p>
            Visitors and search engines who open an old address are sent to the new page with a permanent (301) redirect.
            Upload a CSV to add many at once. Redirects for products and blog articles come from the Legacy website URL
            on that product or article, so change those there. Redirects only apply to addresses that no longer have a page.
          </p>
        </div>
        {error && <div className="admin-notice admin-redirect-error"><p>{errorMessage(error, "Could not load redirects.")}</p></div>}
        {deleteError && <div className="admin-notice admin-redirect-error"><p>{deleteError}</p></div>}
        {isLoading && <p className="admin-empty">Loading redirects…</p>}
        {!isLoading && !error && redirects.length === 0 && (
          <p className="admin-empty">No redirects yet. Upload a CSV to add some.</p>
        )}
        {redirects.length > 0 && (
          <>
            <div className="admin-redirect-toolbar">
              <label className="admin-search">
                <Icon name="search" size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search old or new paths"
                  aria-label="Search redirects"
                  data-testid="redirect-search"
                />
              </label>
              <span className="admin-redirect-count">
                {filtered.length === redirects.length
                  ? `${redirects.length} redirects (${uploadedCount} uploaded)`
                  : `${filtered.length} of ${redirects.length} redirects`}
              </span>
            </div>
            {filtered.length === 0 ? (
              <p className="admin-empty">No redirects match that search.</p>
            ) : (
              <div className="admin-table-card admin-redirect-table">
                <table>
                  <thead>
                    <tr>
                      <th>Old address</th>
                      <th>Redirects to</th>
                      <th>Source</th>
                      <th>Added</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((item) => (
                      <tr key={item.id} data-testid={`redirect-row-${item.id}`}>
                        <td><code>{item.fromPath}</code></td>
                        <td><code>{item.toPath}</code></td>
                        <td>{SOURCE_LABELS[item.source]}</td>
                        <td>{new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td>
                          {(item.source === "uploaded" || item.source === "catalogue") && (
                            <button
                              className="admin-text-button danger"
                              type="button"
                              onClick={() => setPendingDelete(item)}
                              aria-label={`Delete redirect from ${item.fromPath}`}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pageCount > 1 && (
              <div className="admin-redirect-pager">
                <button className="admin-button outline small" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {page + 1} of {pageCount}</span>
                <button className="admin-button outline small" type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this redirect?"
          body={`${pendingDelete.fromPath} will stop redirecting and show a "page not found" message.`}
          confirmLabel="Delete redirect"
          busyLabel="Deleting…"
          busy={deleteRedirect.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { void confirmDelete(); }}
        />
      )}
    </>
  );
}
