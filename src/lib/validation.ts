import { z } from "zod";

import { normalizePhone, toDateTimeLocalValue } from "@/lib/cases";
import {
  PRODUCT_OPTIONS,
  RECOVERY_STATUS_OPTIONS,
  SALE_RESULT_OPTIONS,
  SALE_TYPE_OPTIONS,
} from "@/lib/constants";
import type {
  CaseRecord,
  ProductType,
  RecoveryCaseStatus,
  SaleResult,
  SaleFollowUpRecord,
  SaleType,
} from "@/lib/types";

const productValues = PRODUCT_OPTIONS.map(
  (option) => option.value,
) as [ProductType, ...ProductType[]];

const recoveryStatusValues = RECOVERY_STATUS_OPTIONS.map(
  (option) => option.value,
) as [RecoveryCaseStatus, ...RecoveryCaseStatus[]];

const saleTypeValues = SALE_TYPE_OPTIONS.map(
  (option) => option.value,
) as [SaleType, ...SaleType[]];

const saleResultValues = SALE_RESULT_OPTIONS.map(
  (option) => option.value,
) as [SaleResult, ...SaleResult[]];

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export const caseFormSchema = z
  .object({
    customer_name: z
      .string()
      .trim()
      .optional()
      .default(""),
    phone: z
      .string()
      .trim()
      .min(1, "Ingresa el número del cliente.")
      .refine(
        (value) => /^\+?\d{7,15}$/.test(normalizePhone(value)),
        "Usa solo dígitos y un + opcional al inicio.",
      ),
    product_type: z.enum(productValues, {
      error: () => ({ message: "Selecciona un tipo de producto." }),
    }),
    status: z.enum(recoveryStatusValues, {
      error: () => ({ message: "Selecciona un estado." }),
    }),
    scheduled_at: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine(
        (value) => !value || !Number.isNaN(new Date(value).getTime()),
        "Ingresa una fecha y hora válidas.",
      ),
    notes: z
      .string()
      .trim()
      .max(1000, "Las notas no deben pasar de 1000 caracteres.")
      .optional()
      .default(""),
  })
  .superRefine((values, context) => {
    if (values.status === "agendado" && !values.scheduled_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduled_at"],
        message: "La fecha y hora son obligatorias cuando el caso está agendado.",
      });
    }
  });

export const saleFollowUpSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(1, "Ingresa el número.")
      .refine(
        (value) => /^\+?\d{7,15}$/.test(normalizePhone(value)),
        "Usa solo dígitos y un + opcional al inicio.",
      ),
    sec: z.string().trim().min(1, "Ingresa el SEC."),
    product_type: z.enum(productValues, {
      error: () => ({ message: "Selecciona el producto." }),
    }),
    sale_type: z.enum(saleTypeValues, {
      error: () => ({ message: "Selecciona el tipo de venta." }),
    }),
    sale_result: z.enum(saleResultValues).optional(),
    picked_up: z.boolean().optional(),
    for_when: z.string().trim().min(1, "Ingresa para cuándo es."),
    sale_date: z
      .string()
      .trim()
      .min(1, "Ingresa la fecha.")
      .refine(
        (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
        "Usa una fecha válida.",
      ),
  })
  .superRefine((values, context) => {
    if (values.picked_up && values.sale_type !== "recojo") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["picked_up"],
        message: "Recogido aplica solo a ventas de recojo.",
      });
    }
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type CaseFormInput = z.input<typeof caseFormSchema>;
export type SaleFollowUpFormInput = z.input<typeof saleFollowUpSchema>;
export type CasePayload = {
  customer_name: string;
  phone: string;
  product_type: ProductType;
  status: RecoveryCaseStatus;
  scheduled_at: string | null;
  notes: string | null;
};
export type SaleFollowUpPayload = {
  phone: string;
  sec: string;
  product_type: ProductType;
  sale_type: SaleType;
  sale_result: SaleResult;
  picked_up: boolean;
  for_when: string;
  sale_date: string;
};

export function toCasePayload(input: CaseFormInput): CasePayload {
  const parsed = caseFormSchema.parse(input);
  const normalizedPhone = normalizePhone(parsed.phone);

  return {
    customer_name: parsed.customer_name.trim() || normalizedPhone,
    phone: normalizedPhone,
    product_type: parsed.product_type,
    status: parsed.status,
    scheduled_at: parsed.scheduled_at
      ? new Date(parsed.scheduled_at).toISOString()
      : null,
    notes: parsed.notes ? parsed.notes.trim() || null : null,
  };
}

export function getCaseFormDefaults(
  caseItem: CaseRecord | null | undefined,
): CaseFormInput {
  return {
    customer_name: "",
    phone: caseItem?.phone ?? "",
    product_type: caseItem?.product_type ?? "reno",
    status: caseItem?.status === "perdido" ? "perdido" : "agendado",
    scheduled_at: toDateTimeLocalValue(caseItem?.scheduled_at),
    notes: caseItem?.notes ?? "",
  };
}

export function toSaleFollowUpPayload(
  input: SaleFollowUpFormInput,
  currentSale?: SaleFollowUpRecord | null,
): SaleFollowUpPayload {
  const parsed = saleFollowUpSchema.parse(input);
  const resolvedSaleResult =
    parsed.sale_result ?? currentSale?.sale_result ?? "pendiente";
  const resolvedPickedUp =
    (parsed.picked_up ?? currentSale?.picked_up ?? false) &&
    parsed.sale_type === "recojo" &&
    resolvedSaleResult !== "caida";

  return {
    phone: normalizePhone(parsed.phone),
    sec: parsed.sec.trim(),
    product_type: parsed.product_type,
    sale_type: parsed.sale_type,
    sale_result: resolvedPickedUp ? "venta" : resolvedSaleResult,
    picked_up: resolvedPickedUp,
    for_when: parsed.for_when.trim(),
    sale_date: parsed.sale_date,
  };
}

export function getSaleFollowUpDefaults(
  saleItem: SaleFollowUpRecord | null | undefined,
): SaleFollowUpFormInput {
  return {
    phone: saleItem?.phone ?? "",
    sec: saleItem?.sec ?? "",
    product_type: saleItem?.product_type ?? "reno",
    sale_type: saleItem?.sale_type ?? "recojo",
    sale_result: saleItem?.sale_result ?? "pendiente",
    picked_up: saleItem?.picked_up ?? false,
    for_when: saleItem?.for_when ?? "",
    sale_date: saleItem?.sale_date ?? "",
  };
}
