"use client";
import { useState } from "react";
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
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to sign up");
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError("Failed to auto-login. Please proceed to log in.");
        setLoading(false);
      } else {
        router.push("/");
      }
    } catch {
      setError("Network error — please check your connection and try again.");
      setLoading(false);
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
          <button type="submit" disabled={loading} style={{ ...styles.primaryBtn, width: '100%', marginTop: '1rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#B7B4AA' }}>
          Already have an account? <Link href="/login" style={{ color: '#D9A441' }}>Log in</Link>
        </div>
      </section>
    </div>
  );
}
