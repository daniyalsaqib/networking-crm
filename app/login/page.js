"use client";
import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formStyles as styles } from "../../components/formStyles";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const authError = searchParams.get("error");
    if (authError === "OAuthSignin" || authError === "OAuthCallback") {
      setError("Google sign-in is not configured yet or the credentials in .env.local are missing/invalid.");
    } else if (authError) {
      setError(`Authentication error: ${authError}`);
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(
          res.error === "This account uses Google sign-in. Please use the Google button."
            ? res.error
            : "Invalid email or password"
        );
      } else {
        router.push("/");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setError("Failed to initiate Google sign-in.");
      setGoogleLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#14181F' }}>
      <section style={{ ...styles.panel, width: '100%', maxWidth: '400px' }}>
        <header style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Log in</h2>
            <p style={styles.panelDesc}>Welcome back to Networking CRM</p>
          </div>
        </header>

        {error && <div style={{ background: "#2A1414", border: "1px solid #D4534E", color: "#F09595", padding: "0.6rem 0.9rem", borderRadius: "8px", fontSize: "13px", marginBottom: "1rem" }}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.fieldGroup}>
            <label htmlFor="login-email" style={styles.fieldLabel}>Email</label>
            <input
              id="login-email"
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label htmlFor="login-password" style={styles.fieldLabel}>Password</label>
            <input
              id="login-password"
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading || googleLoading} style={{ ...styles.primaryBtn, width: '100%', marginTop: '1rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            style={{ background: "#1C222C", border: "1px solid #2A303B", color: "#B7B4AA", padding: "0.6rem 1.1rem", borderRadius: "8px", fontSize: "13px", cursor: "pointer", width: '100%', opacity: googleLoading ? 0.6 : 1 }}
          >
            {googleLoading ? "Connecting to Google..." : "Sign in with Google"}
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#B7B4AA' }}>
          Don't have an account? <Link href="/signup" style={{ color: '#D9A441' }}>Sign up</Link>
        </div>
      </section>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
