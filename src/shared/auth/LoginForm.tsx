"use client";

import { type FormEvent, useState } from "react";

import type { CurrentUser } from "@/shared/auth/types";
import styles from "@/shared/auth/LoginForm.module.css";

type LoginResponse = {
  user: CurrentUser;
};

const requestLogin = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error("E-mail ou senha inválidos");
  }

  return data as LoginResponse;
};

export function LoginForm() {
  const [email, setEmail] = useState("admin@hubaiq.local");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    void requestLogin(email, password)
      .then(() => {
        window.location.reload();
      })
      .catch((caughtError) => {
        setError(
          caughtError instanceof Error ? caughtError.message : "Login não concluído",
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>aiq</div>
        <div className={styles.title}>
          <h1>Entrar no Hub</h1>
          <p>Acesse a central de atendimento.</p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <div className={styles.error}>{error}</div> : null}
          <button className={styles.button} type="submit" disabled={isSubmitting}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
