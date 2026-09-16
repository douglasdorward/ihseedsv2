import { useEffect, useState } from "react";
import {
  ClerkLoaded,
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
} from "@clerk/react";
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
  return (
    <main className="admin-auth-page">
      <div className="admin-auth-context">
        <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
        <h1>Authorized personnel only</h1>
        <p>Sign in with an approved administrator email.</p>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-in`}
        forceRedirectUrl={basePath}
      />
    </main>
  );
}

function InvitationScreen() {
  const hasTicket = new URLSearchParams(window.location.search).has("__clerk_ticket");
  if (!hasTicket) {
    return (
      <main className="admin-auth-page">
        <section className="admin-access-card">
          <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
          <p className="admin-auth-eyebrow">Private administration</p>
          <h1>Invitation required</h1>
          <p>Administrator accounts can only be created from an invitation sent by an existing administrator.</p>
          <button type="button" onClick={() => navigate(`${basePath}/sign-in`)}>
            Return to sign in
          </button>
        </section>
      </main>
    );
  }
  return (
    <main className="admin-auth-page">
      <div className="admin-auth-context">
        <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
        <h1>Accept administrator invitation</h1>
        <p>Create credentials for the invited email address.</p>
      </div>
      <SignUp
        routing="path"
        path={`${basePath}/invitation`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={basePath}
      />
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

  if (location.startsWith(`${basePath}/sign-in`)) return <AuthScreen />;
  if (location.startsWith(`${basePath}/invitation`)) return <InvitationScreen />;
  if (!isLoaded || loading) {
    return <main className="admin-auth-page"><div className="admin-auth-loading">Checking administrator access…</div></main>;
  }
  if (!session?.authorized) {
    if (session?.signedIn || isSignedIn) return <AccessDenied />;
    navigate(`${basePath}/sign-in`, { replace: true });
    return null;
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
      <Admin />
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
      localization={{
        signIn: { start: { title: "Authorized personnel only", subtitle: "Sign in with an approved administrator email" } },
      }}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <ClerkLoaded>
        <AdminGate />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
