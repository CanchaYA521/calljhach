import type {
  KnowledgeDocumentAuditAction,
  KnowledgeChatScope,
  CaseStatus,
  DateFilter,
  KnowledgeDocumentStatus,
  KnowledgeProductType,
  ProductType,
  RecoveryCaseStatus,
  RecoveryPreset,
  SaleDateFilter,
  SaleResult,
  SalesPreset,
  SaleType,
} from "@/lib/types";

export const DEFAULT_TIMEZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "America/Lima";

export const PRODUCT_OPTIONS: Array<{ value: ProductType; label: string }> = [
  { value: "reno", label: "Renovación de equipo" },
  { value: "porta", label: "Portabilidad" },
  { value: "linea_nueva", label: "Línea nueva" },
  { value: "fija", label: "Internet fijo (alta fija)" },
  { value: "migracion", label: "Migración" },
  { value: "upgrade", label: "Cambio de plan" },
];

export const KNOWLEDGE_PRODUCT_OPTIONS: Array<{
  value: KnowledgeProductType;
  label: string;
}> = [{ value: "general", label: "General" }, ...PRODUCT_OPTIONS];

export const STATUS_OPTIONS: Array<{ value: CaseStatus; label: string }> = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "agendado", label: "Agendado" },
  { value: "recuperado", label: "Recuperado" },
  { value: "perdido", label: "Perdido" },
];

export const RECOVERY_STATUS_OPTIONS: Array<{
  value: RecoveryCaseStatus;
  label: string;
}> = [
  { value: "agendado", label: "Agendado" },
  { value: "perdido", label: "Perdido" },
];

export const DATE_FILTER_OPTIONS: Array<{ value: DateFilter; label: string }> = [
  { value: "all", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "upcoming", label: "Próximas" },
  { value: "overdue", label: "Vencidas" },
  { value: "unscheduled", label: "Sin agenda" },
];

export const RECOVERY_PRESET_LABELS: Record<RecoveryPreset, string> = {
  all: "Todos",
  open: "Abiertos",
  today: "Hoy",
  recovered: "Recuperados",
  overdue: "Vencidos",
};

export const SALE_TYPE_OPTIONS: Array<{ value: SaleType; label: string }> = [
  { value: "recojo", label: "Recojo" },
  { value: "delivery", label: "Delivery" },
];

export const SALE_RESULT_OPTIONS: Array<{ value: SaleResult; label: string }> = [
  { value: "pendiente", label: "Pendiente" },
  { value: "venta", label: "Venta" },
  { value: "caida", label: "Caída" },
];

export const SALE_DATE_FILTER_OPTIONS: Array<{
  value: SaleDateFilter;
  label: string;
}> = [
  { value: "all", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "upcoming", label: "Próximas" },
  { value: "past", label: "Pasadas" },
];

export const SALES_PRESET_LABELS: Record<SalesPreset, string> = {
  all: "Todos",
  pending: "Pendientes",
  sold: "Ventas",
  dropped: "Caídas",
  today: "Hoy",
};

export const PRODUCT_LABELS = Object.fromEntries(
  PRODUCT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ProductType, string>;

export const KNOWLEDGE_PRODUCT_LABELS = Object.fromEntries(
  KNOWLEDGE_PRODUCT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<KnowledgeProductType, string>;

export const STATUS_LABELS = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<CaseStatus, string>;

export const SALE_TYPE_LABELS = Object.fromEntries(
  SALE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<SaleType, string>;

export const SALE_RESULT_LABELS = Object.fromEntries(
  SALE_RESULT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<SaleResult, string>;

export const STATUS_TONES: Record<CaseStatus, string> = {
  nuevo: "bg-white/80 text-foreground border-line",
  contactado: "bg-amber-100 text-amber-900 border-amber-200",
  agendado: "bg-sky-100 text-sky-900 border-sky-200",
  recuperado: "bg-emerald-100 text-emerald-900 border-emerald-200",
  perdido: "bg-rose-100 text-rose-900 border-rose-200",
};

export const SALE_TYPE_TONES: Record<SaleType, string> = {
  recojo: "bg-emerald-100 text-emerald-900 border-emerald-200",
  delivery: "bg-orange-100 text-orange-900 border-orange-200",
};

export const SALE_RESULT_TONES: Record<SaleResult, string> = {
  pendiente: "bg-amber-100 text-amber-900 border-amber-200",
  venta: "bg-emerald-100 text-emerald-900 border-emerald-200",
  caida: "bg-rose-100 text-rose-900 border-rose-200",
};

export const KNOWLEDGE_STATUS_LABELS = {
  processing: "Procesando",
  ready: "Listo",
  error: "Error",
} as const satisfies Record<KnowledgeDocumentStatus, string>;

export const KNOWLEDGE_STATUS_TONES: Record<KnowledgeDocumentStatus, string> = {
  processing: "bg-amber-100 text-amber-900 border-amber-200",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-200",
  error: "bg-rose-100 text-rose-900 border-rose-200",
};

export const KNOWLEDGE_CHAT_SCOPE_LABELS: Record<KnowledgeChatScope, string> = {
  product: "Producto actual",
  all: "Todos",
};

export const KNOWLEDGE_AUDIT_ACTION_LABELS: Record<
  KnowledgeDocumentAuditAction,
  string
> = {
  created: "Creado",
  updated: "Actualizado",
};
