import { useEffect, useState, type FormEvent } from "react";
import {
  ClerkLoaded,
  ClerkProvider,
  useAuth,
  useClerk,
} from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadesOfPurple } from "@clerk/themes";
import Admin from "./pages/Admin";
import { completePasswordRecovery } from "./password-recovery";
import { navigate, useLocation } from "./router";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = (
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? undefined
    : import.meta.env.VITE_CLERK_PROXY_URL
);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type AdminSession = {
  signedIn: boolean;
  authorized: boolean;
  email?: string;
  role?: "admin" | "superadmin";
  mustChangePassword?: boolean;
};

const appearance = {
  theme: shadesOfPurple,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/ih-seeds-logo.png`,
  },
  variables: {
    colorPrimary: "#315b37",
    colorForeground: "#17351e",
    colorMutedForeground: "#657368",
    colorBackground: "#ffffff",
    colorInput: "#f4f6f2",
    colorInputForeground: "#17351e",
    colorDanger: "#9c372d",
    colorNeutral: "#ccd6ca",
    fontFamily: "Arial, sans-serif",
    borderRadius: "12px",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: { width: "440px", maxWidth: "100%", boxShadow: "0 24px 70px rgba(18,49,26,.16)" },
    card: { boxShadow: "none" },
    headerTitle: { color: "#17351e" },
    headerSubtitle: { color: "#657368" },
    header: { display: "none" },
    formButtonPrimary: { backgroundColor: "#315b37" },
    socialButtonsBlockButton: { display: "none" },
    dividerRow: { display: "none" },
    footerAction: { display: "none" },
    footerActionLink: { color: "#315b37" },
  },
};

function AuthScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [authMode, setAuthMode] = useState<"login" | "recovery-email" | "recovery-code" | "recovery-password">("login");
  const [email, setEmail] = useState("");
  const [recoveryEmailAddressId, setRecoveryEmailAddressId] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [recoveryProviderCompleted, setRecoveryProviderCompleted] = useState(false);
  const [clientTrustRequired, setClientTrustRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const showError = (caught: any, fallback: string) => {
    setError(
      caught?.errors?.[0]?.longMessage ||
      caught?.errors?.[0]?.message ||
      caught?.message ||
      fallback,
    );
  };

  const returnToLogin = () => {
    setAuthMode("login");
    setVerificationCode("");
    setRecoveryEmailAddressId("");
    setNewPassword("");
    setPasswordConfirmation("");
    setRecoveryProviderCompleted(false);
    setError("");
    setResendCooldown(0);
  };

  const activateCompletedSignIn = async (result: any) => {
    if (!setActive) throw new Error("Authentication is still loading.");
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("This account requires an unsupported sign-in step.");
    }
    await setActive({ session: result.createdSessionId });
    navigate(basePath, { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;
    setBusy(true);
    setError("");
    try {
      const result = await signIn.create({
        strategy: "password",
        identifier: email.trim(),
        password,
      });
      if (result.status === "needs_client_trust") {
        const emailFactor = result.supportedSecondFactors?.find(
          (factor: any) => factor.strategy === "email_code",
        );
        if (!emailFactor) {
          throw new Error("This account requires an unsupported sign-in step.");
        }
        await signIn.prepareSecondFactor({ strategy: "email_code" });
        setVerificationCode("");
        setClientTrustRequired(true);
        return;
      }
      await activateCompletedSignIn(result);
    } catch (caught: any) {
      showError(caught, "Email or password is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await signIn.create({ identifier: email.trim() });
      const factor = result.supportedFirstFactors?.find(
        (candidate: any) => candidate.strategy === "reset_password_email_code",
      ) as { emailAddressId?: string } | undefined;
      if (!factor?.emailAddressId) throw new Error("This account does not have a recoverable email address.");
      setRecoveryEmailAddressId(factor.emailAddressId);
      await signIn.prepareFirstFactor({
        strategy: "reset_password_email_code",
        emailAddressId: factor.emailAddressId,
      });
      setVerificationCode("");
      setRecoveryProviderCompleted(false);
      setResendCooldown(30);
      setAuthMode("recovery-code");
    } catch (caught: any) {
      showError(caught, "We could not start password recovery. Check the email address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const resendPasswordResetCode = async () => {
    if (!isLoaded || busy || resendCooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      if (!recoveryEmailAddressId) throw new Error("Start password recovery again.");
      await signIn.prepareFirstFactor({
        strategy: "reset_password_email_code",
        emailAddressId: recoveryEmailAddressId,
      });
      setResendCooldown(30);
    } catch (caught: any) {
      showError(caught, "We could not resend the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyPasswordResetCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded || !verificationCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: verificationCode.trim(),
      });
      setRecoveryProviderCompleted(false);
      setAuthMode("recovery-password");
    } catch (caught: any) {
      showError(caught, "That code is incorrect or has expired. Request a new code and try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded || newPassword !== passwordConfirmation) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 15 || newPassword.length > 128) {
      setError("Choose a new password between 15 and 128 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!setActive) throw new Error("Authentication is still loading.");
      await completePasswordRecovery({
        password: newPassword,
        providerCompleted: recoveryProviderCompleted,
        resetPassword: (params) => signIn.resetPassword(params),
        setActive: (params) => setActive(params),
        onProviderCompleted: () => setRecoveryProviderCompleted(true),
        reconcile: async () => {
          const response = await fetch("/api/auth/recovery/complete", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ newPassword }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body.error || "Your password changed, but administrator access could not be confirmed.");
          }
        },
      });
      navigate(basePath, { replace: true });
    } catch (caught: any) {
      showError(caught, "We could not confirm administrator access. Retry to finish recovery, or sign in with your new password.");
    } finally {
      setBusy(false);
    }
  };

  const verifyClientTrust = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;
    setBusy(true);
    setError("");
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: verificationCode.trim(),
      });
      await activateCompletedSignIn(result);
    } catch (caught: any) {
      setError(
        caught?.errors?.[0]?.longMessage ||
        caught?.errors?.[0]?.message ||
        caught?.message ||
        "The verification code is incorrect.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-auth-page">
      <section className="admin-simple-login">
        <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
        <h1>
          {clientTrustRequired
            ? "Verify your sign-in"
            : authMode === "recovery-email"
              ? "Reset your password"
              : authMode === "recovery-code"
                ? "Check your email"
                : authMode === "recovery-password"
                  ? "Choose a new password"
                  : "Administrator login"}
        </h1>
        {authMode === "recovery-email" && <p>Enter your administrator email and we’ll send a verification code.</p>}
        {authMode === "recovery-code" && <p>Enter the code sent to <strong>{email}</strong>.</p>}
        {authMode === "recovery-password" && (
          <p>
            {recoveryProviderCompleted
              ? "Your password changed. Finish confirming administrator access."
              : "Choose a new password of at least 15 characters."}
          </p>
        )}
        <form onSubmit={
          clientTrustRequired
            ? verifyClientTrust
            : authMode === "recovery-email"
              ? requestPasswordReset
              : authMode === "recovery-code"
                ? verifyPasswordResetCode
                : authMode === "recovery-password"
                  ? submitNewPassword
                  : submit
        }>
          {clientTrustRequired ? (
            <label>
              Verification code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                required
                autoFocus
              />
            </label>
          ) : authMode === "recovery-code" ? (
            <label>
              Verification code
              <input type="text" inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required autoFocus />
            </label>
          ) : authMode === "recovery-password" ? (
            <>
              <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={15} maxLength={128} required autoFocus /></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} minLength={15} maxLength={128} required /></label>
            </>
          ) : (
            <>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </label>
              {authMode === "login" && <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>}
            </>
          )}
          {error && <p className="admin-auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={!isLoaded || busy}>
            {busy
              ? "Working…"
              : clientTrustRequired
                ? "Verify sign-in"
                : authMode === "recovery-email"
                  ? "Send recovery code"
                  : authMode === "recovery-code"
                    ? "Verify code"
                    : authMode === "recovery-password"
                      ? recoveryProviderCompleted ? "Finish recovery" : "Set new password"
                      : "Log in"}
          </button>
        </form>
        {authMode === "login" && !clientTrustRequired && (
          <button className="admin-auth-link" type="button" onClick={() => { setAuthMode("recovery-email"); setError(""); }}>
            Forgot password?
          </button>
        )}
        {authMode === "recovery-code" && (
          <button className="admin-auth-link" type="button" disabled={busy || resendCooldown > 0} onClick={resendPasswordResetCode}>
            {resendCooldown ? `Resend code in ${resendCooldown}s` : "Resend code"}
          </button>
        )}
        {authMode !== "login" && !clientTrustRequired && (
          <button className="admin-auth-link" type="button" onClick={returnToLogin}>Back to login</button>
        )}
      </section>
    </main>
  );
}

function PasswordChangeScreen({ onComplete }: { onComplete: () => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The password could not be changed.");
      await onComplete();
    } catch (caught: any) {
      setError(
        caught?.errors?.[0]?.longMessage ||
        caught?.errors?.[0]?.message ||
        caught?.message ||
        "The password could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-auth-page">
      <section className="admin-simple-login">
        <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
        <h1>Choose your password</h1>
        <p>Replace the temporary password before continuing.</p>
        <form onSubmit={submit}>
          <label>Temporary password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={15} required /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={15} required /></label>
          {error && <p className="admin-auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
      </section>
    </main>
  );
}

function AccessDenied() {
  const { signOut } = useClerk();
  return (
    <main className="admin-auth-page">
      <section className="admin-access-card">
        <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
        <p className="admin-auth-eyebrow">Signed in</p>
        <h1>Administrator access required</h1>
        <p>Your account is valid, but it has not been granted permission to manage the IH Seeds catalogue. An existing administrator must approve your email address.</p>
        <button type="button" onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}>
          Sign out
        </button>
      </section>
    </main>
  );
}

function AdminGate() {
  const [location] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const isAuthRoute = location.startsWith(`${basePath}/sign-in`);
  const shouldRedirectToSignIn =
    !isAuthRoute &&
    isLoaded &&
    !loading &&
    !session?.authorized &&
    !session?.signedIn &&
    !isSignedIn;

  useEffect(() => {
    document.title = "Admin — IH Seeds";
    document.querySelector('meta[name="description"]')
      ?.setAttribute("content", "IH Seeds catalogue administration.");
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;

    const checkSession = async (isInit = false) => {
      if (isInit && active) setLoading(true);
      try {
        const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (active) {
          setSession({ ...body, authorized: response.ok && body.authorized === true });
        }
      } catch (err) {
        if (active) {
          setSession({ signedIn: Boolean(isSignedIn), authorized: false });
        }
      } finally {
        if (isInit && active) setLoading(false);
      }
    };

    checkSession(true);

    const recheck = () => checkSession(false);
    window.addEventListener("focus", recheck);
    window.addEventListener("admin:unauthorized", recheck);
    const interval = setInterval(recheck, 5 * 60 * 1000);

    return () => {
      active = false;
      window.removeEventListener("focus", recheck);
      window.removeEventListener("admin:unauthorized", recheck);
      clearInterval(interval);
    };
  }, [isLoaded, isSignedIn]);

  const refreshSession = async () => {
    const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setSession({ ...body, authorized: response.ok && body.authorized === true });
  };

  useEffect(() => {
    if (shouldRedirectToSignIn) {
      navigate(`${basePath}/sign-in`, { replace: true });
    }
  }, [shouldRedirectToSignIn]);

  if (location.startsWith(`${basePath}/sign-in`)) return <AuthScreen />;
  if (!isLoaded || loading) {
    return <main className="admin-auth-page"><div className="admin-auth-loading">Checking administrator access…</div></main>;
  }
  if (shouldRedirectToSignIn) {
    return <main className="admin-auth-page"><div className="admin-auth-loading">Opening administrator sign in…</div></main>;
  }
  if (!session?.authorized) {
    if (session?.signedIn || isSignedIn) return <AccessDenied />;
    return <AuthScreen />;
  }
  if (session.mustChangePassword) {
    return <PasswordChangeScreen onComplete={refreshSession} />;
  }

  return (
    <Admin
      role={session.role ?? "admin"}
      accountName={session.email ?? "Administrator"}
      onSignOut={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
    />
  );
}

export default function App() {
  if (!clerkPubKey) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
  }
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <ClerkLoaded>
        <AdminGate />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
