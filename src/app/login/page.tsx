import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getSession } from "@/lib/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) {
    redirect("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand-mark" aria-hidden="true">TQ</div>
        <p className="login-eyebrow">TENA INTERNAL TOOLS</p>
        <h1 id="login-title">Tena Query Desk</h1>
        <p className="login-description">
          사내 DB 스키마를 기반으로 안전한 조회 SQL을 준비하는 내부 시스템입니다.
        </p>
        <LoginForm />
        <p className="login-notice">승인된 사내 사용자만 이용해 주세요.</p>
      </section>
    </main>
  );
}
