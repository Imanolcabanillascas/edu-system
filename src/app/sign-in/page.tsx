"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { IconSchool, IconAlert, IconLoader } from "@/components/icons";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ color: "var(--accent)", display: "flex", justifyContent: "center" }}><IconSchool size={32} /></div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: "var(--text)", marginTop: 8 }}>EduAdmin</h1>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: 4 }}>Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 32 }}>
          {error && (
            <div style={{ background: "var(--danger)22", color: "var(--danger)", padding: "10px 14px", borderRadius: 9, fontSize: ".85rem", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <IconAlert size={16} /> {error}
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@colegio.edu" />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: 8, padding: "12px", justifyContent: "center" }}>
            {loading && <IconLoader size={16} />} {loading ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </main>
  );
}
