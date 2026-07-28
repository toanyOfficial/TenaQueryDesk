"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setPassword("");
        setError(result.error ?? "로그인에 실패했습니다.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("로그인 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="shared-password">공용 비밀번호</label>
      <input
        id="shared-password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        maxLength={256}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={isSubmitting}
        aria-describedby={error ? "login-error" : undefined}
      />
      <p
        id="login-error"
        className="login-error"
        role="alert"
        aria-live="polite"
      >
        {error || " "}
      </p>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
