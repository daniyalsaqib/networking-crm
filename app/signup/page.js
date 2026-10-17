"use client";
import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formStyles as styles } from "../../components/formStyles";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  const requestSeqRef = useRef(0);
  const googleSeqRef = useRef(0);

  async function handleGoogleSignIn() {
    const currentReq = ++googleSeqRef.current;
    setError("");
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      if (googleSeqRef.current === currentReq) {
        setError("Failed to initiate Google sign-in.");
      }
    } finally {
      if (googleSeqRef.current === currentReq) {
        setGoogleLoading(false);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const currentReq = ++requestSeqRef.current;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (requestSeqRef.current !== currentReq) return;

      if (!res.ok) {
        setError(data.error || "Failed to sign up");
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (requestSeqRef.current !== currentReq) return;

      if (signInRes?.error) {
        setError("Failed to auto-login. Please proceed to log in.");
      } else {
        router.push("/");
      }
    } catch {
      if (requestSeqRef.current === currentReq) {
        setError("Network error — please check your connection and try again.");
      }
    } finally {
      if (requestSeqRef.current === currentReq) {
        setLoading(false);
      }
    }
  }

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#14181F' }}>
      <section style={{ ...styles.panel, width: '100%', maxWidth: '400px' }}>
        <header style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Sign up</h2>
            <p style={styles.panelDesc}>Create an account for Networking CRM</p>
          </div>
        </header>

        {error && <div style={{ background: "#2A1414", border: "1px solid #D4534E", color: "#F09595", padding: "0.6rem 0.9rem", borderRadius: "8px", fontSize: "13px", marginBottom: "1rem" }}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.fieldGroup}>
            <label htmlFor="signup-name" style={styles.fieldLabel}>Name</label>
            <input
              id="signup-name"
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label htmlFor="signup-email" style={styles.fieldLabel}>Email</label>
            <input
              id="signup-email"
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label htmlFor="signup-password" style={styles.fieldLabel}>Password (min 6 chars)</label>
            <input
              id="signup-password"
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={loading || googleLoading} style={{ ...styles.primaryBtn, width: '100%', marginTop: '1rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            style={{ background: "#1C222C", border: "1px solid #2A303B", color: "#B7B4AA", padding: "0.6rem 1.1rem", borderRadius: "8px", fontSize: "13px", cursor: "pointer", width: '100%', opacity: googleLoading ? 0.6 : 1 }}
          >
            {googleLoading ? "Connecting to Google..." : "Sign up with Google"}
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#B7B4AA' }}>
          Already have an account? <Link href="/login" style={{ color: '#D9A441' }}>Log in</Link>
        </div>
      </section>
    </div>
  );
}
