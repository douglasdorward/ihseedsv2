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
import { navigate, useLocation } from "./router";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [clientTrustRequired, setClientTrustRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      setError(
        caught?.errors?.[0]?.longMessage ||
        caught?.errors?.[0]?.message ||
        caught?.message ||
        "Email or password is incorrect.",
      );
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
        <h1>{clientTrustRequired ? "Verify your sign-in" : "Administrator login"}</h1>
        <form onSubmit={clientTrustRequired ? verifyClientTrust : submit}>
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
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            </>
          )}
          {error && <p className="admin-auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={!isLoaded || busy}>
            {busy ? (clientTrustRequired ? "Verifying…" : "Logging in…") : clientTrustRequired ? "Verify sign-in" : "Log in"}
          </button>
        </form>
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
    <>
      <button
        className="admin-global-signout"
        type="button"
        onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
      >
        Sign out
      </button>
      <Admin role={session.role ?? "admin"} />
    </>
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
