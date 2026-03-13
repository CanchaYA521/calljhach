"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  PRODUCT_OPTIONS,
  SALE_TYPE_OPTIONS,
} from "@/lib/constants";
import { formatCalendarDate } from "@/lib/sales";
import { createClient } from "@/lib/supabase/client";
import type { SaleFollowUpRecord } from "@/lib/types";
import {
  getSaleFollowUpDefaults,
  saleFollowUpSchema,
  type SaleFollowUpFormInput,
  toSaleFollowUpPayload,
} from "@/lib/validation";

type SaleFollowUpFormProps = {
  isDeleting?: boolean;
  onDelete?: () => void;
  selectedSale: SaleFollowUpRecord | null;
  onSaved: (saleId: string) => void;
  onStartFresh: () => void;
};

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-danger">{message}</p>;
}

export function SaleFollowUpForm({
  isDeleting = false,
  onDelete,
  selectedSale,
  onSaved,
  onStartFresh,
}: SaleFollowUpFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<"venta" | "caida" | null>(null);
  const form = useForm<SaleFollowUpFormInput>({
    resolver: zodResolver(saleFollowUpSchema),
    defaultValues: getSaleFollowUpDefaults(selectedSale),
  });

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = form;

  useEffect(() => {
    reset(getSaleFollowUpDefaults(selectedSale));
  }, [reset, selectedSale]);

  const isEditing = Boolean(selectedSale);

  async function runQuickAction(
    updates: Partial<{
      sale_result: "pendiente" | "venta" | "caida";
      picked_up: boolean;
    }>,
    action: "venta" | "caida",
  ) {
    if (!selectedSale) {
      return;
    }

    setServerError(null);
    setQuickAction(action);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sale_follow_ups")
      .update(updates)
      .eq("id", selectedSale.id)
      .select("*")
      .single();

    setQuickAction(null);

    if (error) {
      setServerError(error.message);
      return;
    }

    reset(getSaleFollowUpDefaults(data as SaleFollowUpRecord));
    onSaved((data as SaleFollowUpRecord).id);
  }

  async function onSubmit(values: SaleFollowUpFormInput) {
    setServerError(null);

    const payload = toSaleFollowUpPayload(values, selectedSale);
    const supabase = createClient();
    const query = isEditing
      ? supabase
          .from("sale_follow_ups")
          .update(payload)
          .eq("id", selectedSale!.id)
          .select("*")
          .single()
      : supabase.from("sale_follow_ups").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      setServerError(error.message);
      return;
    }

    reset(getSaleFollowUpDefaults(data as SaleFollowUpRecord));
    onSaved((data as SaleFollowUpRecord).id);
  }

  return (
    <aside className="panel rounded-[1.7rem] p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
            Seguimiento de venta
          </p>
          <h2 className="mt-1.5 text-xl font-semibold">
            {isEditing ? "Editar seguimiento" : "Nuevo seguimiento"}
          </h2>
          <p className="mt-1 text-sm muted-text">
            Registro rápido. Cierre con venta o caída.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <button
              className="btn-secondary px-3 py-2 text-sm font-semibold text-danger"
              disabled={isDeleting || isSubmitting || quickAction !== null}
              onClick={onDelete}
              type="button"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </button>
          ) : null}
          <button
            className="btn-secondary px-3 py-2 text-sm font-semibold"
            onClick={() => {
              reset(getSaleFollowUpDefaults(null));
              onStartFresh();
            }}
            type="button"
          >
            {isEditing ? "Nuevo" : "Limpiar"}
          </button>
        </div>
      </div>

      {selectedSale ? (
        <div className="mb-4 rounded-[1.2rem] border border-line bg-white/60 px-3 py-2 text-sm text-muted">
          Fecha objetivo: {formatCalendarDate(selectedSale.sale_date)}
        </div>
      ) : null}

      {selectedSale ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <button
            className="btn-secondary px-3 py-2 text-sm font-semibold"
            disabled={quickAction !== null || isDeleting}
            onClick={() =>
              runQuickAction({ sale_result: "venta", picked_up: false }, "venta")
            }
            type="button"
          >
            {quickAction === "venta" ? "Marcando..." : "Marcar venta"}
          </button>
          <button
            className="btn-secondary px-3 py-2 text-sm font-semibold"
            disabled={quickAction !== null || isDeleting}
            onClick={() =>
              runQuickAction({ sale_result: "caida", picked_up: false }, "caida")
            }
            type="button"
          >
            {quickAction === "caida" ? "Marcando..." : "Marcar caída"}
          </button>
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sale_phone">
              Número
            </label>
            <input
              {...register("phone")}
              className="field"
              id="sale_phone"
              placeholder="+51999111222"
            />
            <FormError message={errors.phone?.message} />
          </div>

          <div>
            <label className="label" htmlFor="sec">
              SEC
            </label>
            <input
              {...register("sec")}
              className="field"
              id="sec"
              placeholder="SEC-1287"
            />
            <FormError message={errors.sec?.message} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sale_product_type">
              Producto
            </label>
            <select
              {...register("product_type")}
              className="field"
              id="sale_product_type"
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
            <label className="label" htmlFor="sale_type">
              Tipo de venta
            </label>
            <select {...register("sale_type")} className="field" id="sale_type">
              {SALE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormError message={errors.sale_type?.message} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sale_date">
              Fecha
            </label>
            <input
              {...register("sale_date")}
              className="field"
              id="sale_date"
              type="date"
            />
            <FormError message={errors.sale_date?.message} />
          </div>

          <div>
            <label className="label" htmlFor="for_when">
              Para cuándo
            </label>
            <input
              {...register("for_when")}
              className="field"
              id="for_when"
              placeholder="Mañana PM / sábado / 1ra hora"
            />
            <FormError message={errors.for_when?.message} />
          </div>
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
                ? "Actualizar seguimiento"
                : "Guardar seguimiento"}
          </button>
          {isEditing ? (
            <button
              className="btn-secondary w-full px-5 py-3 text-sm font-semibold text-danger"
              disabled={isSubmitting || isDeleting || quickAction !== null}
              onClick={onDelete}
              type="button"
            >
              {isDeleting ? "Eliminando seguimiento..." : "Eliminar seguimiento"}
            </button>
          ) : null}
        </div>
      </form>
    </aside>
  );
}
