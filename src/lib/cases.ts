import { DEFAULT_TIMEZONE, PRODUCT_LABELS } from "@/lib/constants";
import type {
  CaseRecord,
  DashboardSummary,
  DateFilter,
  RecoveryPreset,
} from "@/lib/types";

export function normalizePhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

function getDateKey(dateLike: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateLike));
}

export function formatDateTime(
  iso: string | null | undefined,
  timezone = DEFAULT_TIMEZONE,
) {
  if (!iso) {
    return "Sin agenda";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function matchesSearch(caseItem: CaseRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return (
    caseItem.phone.toLowerCase().includes(normalizedQuery) ||
    PRODUCT_LABELS[caseItem.product_type].toLowerCase().includes(normalizedQuery)
  );
}

export function matchesDateFilter(
  caseItem: CaseRecord,
  filter: DateFilter,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unscheduled") {
    return !caseItem.scheduled_at;
  }

  if (!caseItem.scheduled_at) {
    return false;
  }

  const scheduledTime = new Date(caseItem.scheduled_at).getTime();
  const nowTime = now.getTime();
  const isToday = getDateKey(caseItem.scheduled_at, timezone) === getDateKey(now, timezone);

  if (filter === "today") {
    return isToday;
  }

  if (filter === "upcoming") {
    return caseItem.status === "agendado" && scheduledTime >= nowTime;
  }

  return caseItem.status === "agendado" && scheduledTime < nowTime;
}

export function matchesRecoveryPreset(
  caseItem: CaseRecord,
  preset: RecoveryPreset,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  if (preset === "all") {
    return true;
  }

  if (preset === "open") {
    return caseItem.status !== "recuperado" && caseItem.status !== "perdido";
  }

  if (preset === "today") {
    return (
      caseItem.status === "agendado" &&
      caseItem.scheduled_at !== null &&
      getDateKey(caseItem.scheduled_at, timezone) === getDateKey(now, timezone)
    );
  }

  if (preset === "recovered") {
    const recentRecoveryThreshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return (
      caseItem.status === "recuperado" &&
      new Date(caseItem.updated_at).getTime() >= recentRecoveryThreshold
    );
  }

  return (
    caseItem.status === "agendado" &&
    caseItem.scheduled_at !== null &&
    new Date(caseItem.scheduled_at).getTime() < now.getTime()
  );
}

export function sortCases(cases: CaseRecord[]) {
  return [...cases].sort((left, right) => {
    const leftSchedule = left.scheduled_at
      ? new Date(left.scheduled_at).getTime()
      : Number.POSITIVE_INFINITY;
    const rightSchedule = right.scheduled_at
      ? new Date(right.scheduled_at).getTime()
      : Number.POSITIVE_INFINITY;

    if (leftSchedule !== rightSchedule) {
      return leftSchedule - rightSchedule;
    }

    return (
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    );
  });
}

export function computeDashboardSummary(
  cases: CaseRecord[],
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
): DashboardSummary {
  const recentRecoveryThreshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const todayKey = getDateKey(now, timezone);

  return {
    openCount: cases.filter(
      (caseItem) =>
        caseItem.status !== "recuperado" && caseItem.status !== "perdido",
    ).length,
    todayScheduled: cases.filter(
      (caseItem) =>
        caseItem.status === "agendado" &&
        caseItem.scheduled_at &&
        getDateKey(caseItem.scheduled_at, timezone) === todayKey,
    ).length,
    recentRecovered: cases.filter(
      (caseItem) =>
        caseItem.status === "recuperado" &&
        new Date(caseItem.updated_at).getTime() >= recentRecoveryThreshold,
    ).length,
    overdueCount: cases.filter(
      (caseItem) =>
        caseItem.status === "agendado" &&
        caseItem.scheduled_at &&
        new Date(caseItem.scheduled_at).getTime() < now.getTime(),
    ).length,
  };
}
