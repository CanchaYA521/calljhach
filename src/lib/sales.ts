import {
  DEFAULT_TIMEZONE,
  PRODUCT_LABELS,
  SALE_RESULT_LABELS,
  SALE_TYPE_LABELS,
} from "@/lib/constants";
import type {
  SaleDateFilter,
  SaleFollowUpRecord,
  SalesPreset,
  SalesSummary,
} from "@/lib/types";

function getDateKey(dateLike: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateLike);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "Sin fecha";
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(date);
}

export function matchesSaleSearch(saleItem: SaleFollowUpRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return (
    saleItem.phone.toLowerCase().includes(normalizedQuery) ||
    saleItem.sec.toLowerCase().includes(normalizedQuery) ||
    saleItem.for_when.toLowerCase().includes(normalizedQuery) ||
    PRODUCT_LABELS[saleItem.product_type].toLowerCase().includes(normalizedQuery) ||
    SALE_RESULT_LABELS[saleItem.sale_result].toLowerCase().includes(normalizedQuery) ||
    (saleItem.picked_up ? "recogido".includes(normalizedQuery) : false) ||
    SALE_TYPE_LABELS[saleItem.sale_type].toLowerCase().includes(normalizedQuery)
  );
}

export function matchesSaleDateFilter(
  saleItem: SaleFollowUpRecord,
  filter: SaleDateFilter,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  if (filter === "all") {
    return true;
  }

  const todayKey = getDateKey(now, timezone);

  if (filter === "today") {
    return saleItem.sale_date === todayKey;
  }

  if (filter === "upcoming") {
    return saleItem.sale_date > todayKey;
  }

  return saleItem.sale_date < todayKey;
}

export function matchesSalesPreset(
  saleItem: SaleFollowUpRecord,
  preset: SalesPreset,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
) {
  if (preset === "all") {
    return true;
  }

  if (preset === "pending") {
    return saleItem.sale_result === "pendiente";
  }

  if (preset === "sold") {
    return saleItem.sale_result === "venta";
  }

  if (preset === "dropped") {
    return saleItem.sale_result === "caida";
  }

  return saleItem.sale_date === getDateKey(now, timezone);
}

export function sortSaleFollowUps(sales: SaleFollowUpRecord[]) {
  return [...sales].sort((left, right) => {
    if (left.sale_date !== right.sale_date) {
      return left.sale_date.localeCompare(right.sale_date);
    }

    return (
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    );
  });
}

export function computeSalesSummary(
  sales: SaleFollowUpRecord[],
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
): SalesSummary {
  const todayKey = getDateKey(now, timezone);

  return {
    pendingCount: sales.filter((saleItem) => saleItem.sale_result === "pendiente")
      .length,
    soldCount: sales.filter((saleItem) => saleItem.sale_result === "venta").length,
    droppedCount: sales.filter((saleItem) => saleItem.sale_result === "caida").length,
    todayCount: sales.filter((saleItem) => saleItem.sale_date === todayKey).length,
  };
}
