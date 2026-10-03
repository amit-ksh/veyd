"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "signin"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <div className="flex rounded-lg bg-brand-50 p-1 text-sm font-medium">
        {(["signin", "signup"] as const).map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1.5 transition ${
              mode === m
                ? "bg-white shadow-card text-brand-700"
                : "text-slate-500"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {mode === "signup" && (
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Full name"
          aria-label="Full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      )}
      <input
        type="email"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Email address"
        aria-label="Email address"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Password"
        aria-label="Password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />

      {error && <p className="text-sm text-status-fail">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        aria-busy={loading}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2
              aria-hidden
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
            Please wait…
          </span>
        ) : mode === "signin" ? (
          "Sign in"
        ) : (
          "Create account"
        )}
      </button>
    </form>
  );
}
