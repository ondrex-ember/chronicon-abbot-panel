import React, { useState } from "react";
import { Church } from "lucide-react";

interface LoginScreenProps {
  onLogin: (token: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem("abbot_token", data.token);
        onLogin(data.token);
      } else {
        setError(data.error || "Nesprávné heslo.");
      }
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink text-parchment font-serif">
      <div className="w-full max-w-sm p-8 border border-gold/30 rounded-xl bg-ink-soft/60 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <Church className="w-10 h-10 text-gold mx-auto" />
          <h1 className="text-xl font-display tracking-widest text-gold">ABBOT PANEL</h1>
          <p className="text-xs text-parchment/50 italic">Chronicon · Scriptorium GM</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-parchment/60 mb-1.5 font-sans tracking-wider">
              HESLO
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="••••••••"
              className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2.5 text-sm text-parchment focus:outline-none focus:border-gold/50 tracking-widest"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-gold hover:bg-gold/80 disabled:bg-gold/20 text-ink font-display text-xs tracking-widest rounded-lg transition-all font-bold"
          >
            {loading ? "Ověřuji..." : "VSTOUPIT"}
          </button>
        </form>
      </div>
    </div>
  );
}
