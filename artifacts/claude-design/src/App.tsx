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
  developmentBypass?: boolean;
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
    rootBox: { width: "100%" },
    cardBox: { width: "440px", maxWidth: "100%", boxShadow: "0 24px 70px rgba(18,49,26,.16)" },
    card: { boxShadow: "none" },
    headerTitle: { color: "#17351e" },
    headerSubtitle: { color: "#657368" },
    formButtonPrimary: { backgroundColor: "#315b37" },
    footerActionLink: { color: "#315b37" },
  },
};

function AuthScreen({ kind }: { kind: "sign-in" | "sign-up" }) {
  return (
    <main className="admin-auth-page">
      <div className="admin-auth-context">
        <img src={`${basePath}/ih-seeds-logo.png`} alt="IH Seeds" />
        <p>Secure catalogue administration</p>
      </div>
      {kind === "sign-in" ? (
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          forceRedirectUrl={basePath}
        />
      ) : (
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          forceRedirectUrl={basePath}
        />
      )}
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

function DevelopmentAdminGate() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin — IH Seeds";
    let active = true;
    fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (active) {
          setSession({ ...body, authorized: response.ok && body.authorized === true });
        }
      })
      .catch(() => {
        if (active) setSession({ signedIn: false, authorized: false });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <main className="admin-auth-page"><div className="admin-auth-loading">Checking administrator access…</div></main>;
  }
  if (!session?.authorized) {
    return (
      <main className="admin-auth-page">
        <section className="admin-access-card">
          <h1>Admin API unavailable</h1>
          <p>Start the local API on port 8080 with NODE_ENV=development, then refresh.</p>
        </section>
      </main>
    );
  }

  return (
    <>
      {session.developmentBypass ? (
        <div className="admin-development-banner" role="status">
          Development auto-sign-in · Administrator
        </div>
      ) : null}
      <Admin />
    </>
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

  if (location.startsWith(`${basePath}/sign-up`)) return <AuthScreen kind="sign-up" />;
  if (location.startsWith(`${basePath}/sign-in`)) return <AuthScreen kind="sign-in" />;
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
      {session.developmentBypass ? (
        <div className="admin-development-banner" role="status">
          Development auto-sign-in · Administrator
        </div>
      ) : (
        <button
          className="admin-global-signout"
          type="button"
          onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
        >
          Sign out
        </button>
      )}
      <Admin />
    </>
  );
}

export default function App() {
  if (!clerkPubKey) {
    return <DevelopmentAdminGate />;
  }
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "IH Seeds administration", subtitle: "Sign in to manage the catalogue" } },
        signUp: { start: { title: "Create your IH Seeds account", subtitle: "An administrator must grant catalogue access" } },
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
