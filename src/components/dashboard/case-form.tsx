"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { formatDateTime } from "@/lib/cases";
import { PRODUCT_OPTIONS, RECOVERY_STATUS_OPTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { CaseRecord } from "@/lib/types";
import {
  caseFormSchema,
  getCaseFormDefaults,
  type CaseFormInput,
  toCasePayload,
} from "@/lib/validation";

type CaseFormProps = {
  isDeleting?: boolean;
  onDelete?: () => void;
  selectedCase: CaseRecord | null;
  timezone: string;
  onSaved: (caseId: string) => void;
  onStartFresh: () => void;
};

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-danger">{message}</p>;
}

export function CaseForm({
  isDeleting = false,
  onDelete,
  selectedCase,
  timezone,
  onSaved,
  onStartFresh,
}: CaseFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CaseFormInput>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: getCaseFormDefaults(selectedCase),
  });

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = form;

  useEffect(() => {
    reset(getCaseFormDefaults(selectedCase));
  }, [reset, selectedCase]);

  const isEditing = Boolean(selectedCase);

  async function onSubmit(values: CaseFormInput) {
    setServerError(null);

    const payload = toCasePayload(values);
    const supabase = createClient();
    const query = isEditing
      ? supabase
          .from("cases")
          .update(payload)
          .eq("id", selectedCase!.id)
          .select("*")
          .single()
      : supabase.from("cases").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      setServerError(error.message);
      return;
    }

    reset(getCaseFormDefaults(data as CaseRecord));
    onSaved((data as CaseRecord).id);
  }

  return (
    <aside className="panel rounded-[1.7rem] p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
            Gestión comercial
          </p>
          <h2 className="mt-1.5 text-xl font-semibold">
            {isEditing ? "Editar caso" : "Nuevo caso"}
          </h2>
          <p className="mt-1 text-sm muted-text">
            Registro rápido por número, gestión y agenda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <button
              className="btn-secondary px-3 py-2 text-sm font-semibold text-danger"
              disabled={isDeleting || isSubmitting}
              onClick={onDelete}
              type="button"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </button>
          ) : null}
          <button
            className="btn-secondary px-3 py-2 text-sm font-semibold"
            onClick={() => {
              reset(getCaseFormDefaults(null));
              onStartFresh();
            }}
            type="button"
          >
            {isEditing ? "Nuevo" : "Limpiar"}
          </button>
        </div>
      </div>

      {selectedCase ? (
        <div className="mb-4 rounded-[1.2rem] border border-line bg-white/60 px-3 py-2 text-sm text-muted">
          Última actualización: {formatDateTime(selectedCase.updated_at, timezone)}
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <input {...register("customer_name")} type="hidden" />

        <div>
          <label className="label" htmlFor="phone">
            Número
          </label>
          <input
            {...register("phone")}
            className="field"
            id="phone"
            placeholder="+51999111222"
          />
          <p className="mt-1 text-xs muted-text">
            El caso se identifica por número.
          </p>
          <FormError message={errors.phone?.message} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="product_type">
              Producto
            </label>
            <select
              {...register("product_type")}
              className="field"
              id="product_type"
            >
              {PRODUCT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormError message={errors.product_type?.message} />
          </div>

          <div>
            <label className="label" htmlFor="status">
              Estado
            </label>
            <select {...register("status")} className="field" id="status">
              {RECOVERY_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormError message={errors.status?.message} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="scheduled_at">
            Fecha y hora
          </label>
          <input
            {...register("scheduled_at")}
            className="field"
            id="scheduled_at"
            type="datetime-local"
          />
          <p className="mt-1 text-xs muted-text">
            Obligatoria solo si el estado es agendado.
          </p>
          <FormError message={errors.scheduled_at?.message} />
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Notas
          </label>
          <textarea
            {...register("notes")}
            className="field min-h-24 resize-y"
            id="notes"
            placeholder="Notas clave de la llamada"
            rows={4}
          />
          <FormError message={errors.notes?.message} />
        </div>

        {serverError ? (
          <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <button
            className="btn-primary w-full px-5 py-3 text-sm font-semibold"
            disabled={isSubmitting || isDeleting}
            type="submit"
          >
            {isSubmitting
              ? "Guardando..."
              : isEditing
                ? "Actualizar caso"
                : "Guardar caso"}
          </button>
          {isEditing ? (
            <button
              className="btn-secondary w-full px-5 py-3 text-sm font-semibold text-danger"
              disabled={isSubmitting || isDeleting}
              onClick={onDelete}
              type="button"
            >
              {isDeleting ? "Eliminando caso..." : "Eliminar caso"}
            </button>
          ) : null}
        </div>
      </form>
    </aside>
  );
}
