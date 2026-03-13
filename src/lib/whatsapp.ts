import { normalizePhone } from "@/lib/cases";
import { DEFAULT_TIMEZONE, PRODUCT_LABELS, SALE_TYPE_LABELS } from "@/lib/constants";
import type { CaseRecord, SaleFollowUpRecord } from "@/lib/types";

function getPeruHour(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

export function getPeruGreeting(
  now = new Date(),
  timezone = DEFAULT_TIMEZONE,
) {
  const hour = getPeruHour(now, timezone);

  if (hour < 12) {
    return "Buenos días";
  }

  if (hour < 19) {
    return "Buenas tardes";
  }

  return "Buenas noches";
}

function formatPeruDateTimeWithoutYear(
  iso: string | null | undefined,
  timezone = DEFAULT_TIMEZONE,
) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatPeruDate(
  iso: string | null | undefined,
  timezone = DEFAULT_TIMEZONE,
) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    dateStyle: "long",
  }).format(date);
}

function formatPeruDateWithoutYear(
  iso: string | null | undefined,
  timezone = DEFAULT_TIMEZONE,
) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatCalendarDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(date);
}

function formatCalendarDateWithoutYear(dateValue: string | null | undefined) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = normalizePhone(phone).replace(/^\+/, "");

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildRecoveryWhatsAppMessage(
  caseItem: CaseRecord,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  const greeting = getPeruGreeting(now, timezone);
  const productLabel = PRODUCT_LABELS[caseItem.product_type];
  const attendedDate =
    formatPeruDateWithoutYear(caseItem.created_at, timezone) ??
    formatPeruDateWithoutYear(caseItem.updated_at, timezone) ??
    "una fecha reciente";
  const scheduledDate = formatPeruDateTimeWithoutYear(caseItem.scheduled_at, timezone);

  if (caseItem.status === "perdido") {
    return [
      `${greeting}, soy el asesor de Claro que le atendió el ${attendedDate} por su solicitud de ${productLabel}.`,
      "Quería consultar si aún se encuentra animado(a) para retomar la gestión.",
      "Si aún le interesa, podemos agendar una llamada breve para ayudarle con el proceso.",
      "Si tiene alguna consulta o ayuda, pregunte nomás.",
    ].join(" ");
  }

  return [
    `${greeting}, soy el asesor de Claro que le atendió el ${attendedDate} por su solicitud de ${productLabel}.`,
    scheduledDate
      ? `Le escribo para confirmar la llamada agendada para ${scheduledDate}.`
      : "Quería coordinar la llamada pendiente de su gestión.",
    "Quedo atento para confirmar si sigue animado(a) y continuar con el proceso.",
    "Si tiene alguna consulta o ayuda, pregunte nomás.",
  ].join(" ");
}

export function buildSaleWhatsAppMessage(
  saleItem: SaleFollowUpRecord,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  const greeting = getPeruGreeting(now, timezone);
  const productLabel = PRODUCT_LABELS[saleItem.product_type];
  const usesShortDate = saleItem.sale_type === "recojo";
  const attendedDate =
    (usesShortDate
      ? formatPeruDateWithoutYear(saleItem.created_at, timezone)
      : formatPeruDate(saleItem.created_at, timezone)) ??
    (usesShortDate
      ? formatPeruDateWithoutYear(saleItem.updated_at, timezone)
      : formatPeruDate(saleItem.updated_at, timezone)) ??
    "una fecha reciente";
  const saleDate = usesShortDate
    ? formatCalendarDateWithoutYear(saleItem.sale_date)
    : formatCalendarDate(saleItem.sale_date);
  const coordinationWindow = saleDate
    ? `${saleDate}${saleItem.for_when ? `, ${saleItem.for_when}` : ""}`
    : saleItem.for_when;

  if (saleItem.sale_result === "venta") {
    const isPickup = saleItem.sale_type === "recojo";
    const logistics = isPickup ? "el recojo" : "la entrega por delivery";
    const dniReminder = isPickup
      ? "No olvide acercarse con su DNI para completar el proceso."
      : "No olvide tener su DNI a la mano al momento de recibir el delivery.";

    return [
      `${greeting}, soy el asesor de Claro que le atendió el ${attendedDate} por su ${productLabel}.`,
      coordinationWindow
        ? `Le recuerdo que quedó coordinado ${logistics} para ${coordinationWindow}.`
        : `Le recuerdo que quedó coordinado ${logistics}.`,
      isPickup ? `Su código de recojo es ${saleItem.sec}.` : null,
      dniReminder,
      "Si tiene alguna consulta o ayuda, pregunte nomás.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (saleItem.sale_result === "caida") {
    return [
      `${greeting}, soy el asesor de Claro que le atendió el ${attendedDate} por su ${productLabel}.`,
      "Quería saber si desea retomar la gestión.",
      "Si aún le interesa, podemos coordinar una llamada breve para ayudarle con el proceso.",
    ].join(" ");
  }

  return [
    `${greeting}, soy el asesor de Claro que le atendió el ${attendedDate} por su ${productLabel}.`,
    saleItem.for_when
      ? `Quería confirmar si ya se encuentra animado(a) para continuar con lo coordinado para ${saleItem.for_when}.`
      : "Quería confirmar si ya se encuentra animado(a) para continuar con la gestión.",
    `Si le parece, podemos cerrar la coordinación de ${SALE_TYPE_LABELS[saleItem.sale_type].toLowerCase()} y resolver cualquier duda.`,
  ].join(" ");
}

export function buildRecoveryWhatsAppUrl(
  caseItem: CaseRecord,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  return buildWhatsAppUrl(
    caseItem.phone,
    buildRecoveryWhatsAppMessage(caseItem, timezone, now),
  );
}

export function buildSaleWhatsAppUrl(
  saleItem: SaleFollowUpRecord,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  return buildWhatsAppUrl(
    saleItem.phone,
    buildSaleWhatsAppMessage(saleItem, timezone, now),
  );
}
