"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, Message, TextInput } from "@/components/forms";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";

type AuthMode = "password" | "magic";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(
    hasSupabaseConfig()
      ? null
      : {
          kind: "error",
          text: "Supabase is not configured. Add your project URL and anon key to .env.local.",
        },
  );

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage({ kind: "error", text: "Supabase environment variables are missing." });
      return;
    }

    if (!email.trim()) {
      setMessage({ kind: "error", text: "Enter your email address." });
      return;
    }

    if (mode === "password" && !password) {
      setMessage({ kind: "error", text: "Enter your password." });
      return;
    }

    setLoading(true);
    setMessage(null);

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}${nextPath}`,
        },
      });

      if (error) {
        setMessage({ kind: "error", text: error.message });
      } else {
        setMessage({ kind: "success", text: "Check your email for the sign-in link." });
      }

      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage({ kind: "error", text: error.message });
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-md place-items-center">
        <div className="w-full rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Repair Shop
            </p>
            <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Use your Supabase account access to manage purchase requests.
            </p>
          </div>

          {message ? (
            <div className="mb-4">
              <Message kind={message.kind}>{message.text}</Message>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-surface-muted p-1">
            <button
              className={`h-10 rounded text-sm font-semibold ${mode === "password" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
              onClick={() => setMode("password")}
              type="button"
            >
              Password
            </button>
            <button
              className={`h-10 rounded text-sm font-semibold ${mode === "magic" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
              onClick={() => setMode("magic")}
              type="button"
            >
              Email link
            </button>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <Field label="Email">
              <TextInput
                autoComplete="email"
                inputMode="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </Field>

            {mode === "password" ? (
              <Field label="Password">
                <TextInput
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                />
              </Field>
            ) : null}

            <button
              className="h-12 rounded-md bg-accent px-4 text-base font-semibold text-accent-foreground disabled:opacity-60"
              disabled={loading || !supabase}
              type="submit"
            >
              {loading ? "Signing in..." : mode === "magic" ? "Send sign-in link" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
