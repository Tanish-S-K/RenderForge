"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.session) {
        localStorage.setItem("session_id", data.session);
        localStorage.setItem("user_id", data.user_id);
        router.push("/dashboard");
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0] flex flex-col">
      <nav className="flex justify-between items-center px-10 py-5 border-b border-white/5">
        <Link href="/" className="font-mono font-bold text-violet-400 tracking-widest text-sm">RF</Link>
        <Link href="/register" className="text-sm text-white/40 hover:text-white/80 transition-colors">
          Create account
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Welcome back</h1>
            <p className="text-sm text-white/30">Sign in to your RenderForge account</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="bg-red-950/60 border border-red-900/50 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-white/[0.04] border border-white/10 focus:border-violet-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-white/[0.04] border border-white/10 focus:border-violet-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0a0a0f] font-bold text-sm py-2.5 rounded-lg transition-colors mt-1"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f] rounded-full animate-spin" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-sm text-white/25">
              No account?{" "}
              <Link href="/register" className="text-violet-400 hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
