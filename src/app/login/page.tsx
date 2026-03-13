import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { PRODUCT_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel flex rounded-[2rem] p-6 sm:p-8">
          <div className="flex w-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-accent-strong">
                Pulse CRM
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Seguimiento comercial rápido para recuperar clientes.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 muted-text">
                Diseñado para operación personal de call center: registras la gestión,
                agendas el próximo contacto y mantienes cada usuario separado dentro de
                Supabase.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.6rem] border border-line bg-white/58 p-5">
                <p className="text-sm font-semibold">Productos listos</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {PRODUCT_OPTIONS.map((option) => (
                    <span
                      className="rounded-full border border-line bg-white/72 px-3 py-1 text-xs font-semibold"
                      key={option.value}
                    >
                      {option.label}
                    </span>
                  ))}
                </div>
              </article>
              <article className="rounded-[1.6rem] border border-line bg-white/58 p-5">
                <p className="text-sm font-semibold">Qué vas a ver al entrar</p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
                  <li>Dashboard con métricas del día</li>
                  <li>Listado filtrable por estado, producto y agenda</li>
                  <li>Formulario único para crear y editar casos</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="panel flex items-center rounded-[2rem] p-6 sm:p-8">
          <div className="w-full">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-strong">
              Acceso privado
            </p>
            <h2 className="mt-3 text-3xl font-semibold">Inicia sesión</h2>
            <p className="mt-3 text-sm leading-7 muted-text">
              Usa un usuario creado en Supabase Auth. El registro público no está habilitado
              en esta versión.
            </p>

            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
