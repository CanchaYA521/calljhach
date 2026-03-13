"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginFormValues } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    formState: { errors, isSubmitting },
    register,
    handleSubmit,
  } = form;

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    startTransition(() => {
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="label" htmlFor="email">
          Correo
        </label>
        <input
          {...register("email")}
          autoComplete="email"
          className="field"
          id="email"
          placeholder="asesor@empresa.com"
          type="email"
        />
        {errors.email ? (
          <p className="mt-2 text-sm text-danger">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input
          {...register("password")}
          autoComplete="current-password"
          className="field"
          id="password"
          placeholder="Tu contraseña"
          type="password"
        />
        {errors.password ? (
          <p className="mt-2 text-sm text-danger">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {serverError}
        </div>
      ) : null}

      <button
        className="btn-primary w-full px-5 py-3 text-sm font-semibold"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Ingresando..." : "Entrar al CRM"}
      </button>
    </form>
  );
}
