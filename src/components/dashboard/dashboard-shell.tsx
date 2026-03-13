"use client";

import clsx from "clsx";
import { startTransition, useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";

import { CaseForm } from "@/components/dashboard/case-form";
import { KnowledgeSettingsShell } from "@/components/dashboard/knowledge-settings-shell";
import { QuickHelpSheet } from "@/components/dashboard/quick-help-sheet";
import { SaleFollowUpForm } from "@/components/dashboard/sale-follow-up-form";
import {
  DATE_FILTER_OPTIONS,
  PRODUCT_LABELS,
  PRODUCT_OPTIONS,
  RECOVERY_PRESET_LABELS,
  RECOVERY_STATUS_OPTIONS,
  SALES_PRESET_LABELS,
  SALE_DATE_FILTER_OPTIONS,
  SALE_RESULT_LABELS,
  SALE_RESULT_OPTIONS,
  SALE_RESULT_TONES,
  SALE_TYPE_LABELS,
  SALE_TYPE_OPTIONS,
  SALE_TYPE_TONES,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/lib/constants";
import {
  computeDashboardSummary,
  formatDateTime,
  matchesDateFilter,
  matchesRecoveryPreset,
  matchesSearch,
  sortCases,
} from "@/lib/cases";
import {
  computeSalesSummary,
  formatCalendarDate,
  matchesSaleDateFilter,
  matchesSaleSearch,
  matchesSalesPreset,
  sortSaleFollowUps,
} from "@/lib/sales";
import { createClient } from "@/lib/supabase/client";
import {
  buildRecoveryWhatsAppUrl,
  buildSaleWhatsAppUrl,
} from "@/lib/whatsapp";
import type {
  CaseRecord,
  DateFilter,
  KnowledgeDocumentAuditRecord,
  KnowledgeDocumentRecord,
  ProductType,
  RecoveryCaseStatus,
  RecoveryPreset,
  SaleDateFilter,
  SaleFollowUpRecord,
  SaleResult,
  SalesPreset,
  SaleType,
} from "@/lib/types";

type DashboardShellProps = {
  currentUser: {
    email: string | null;
    name: string | null;
  };
  dataError: string | null;
  initialAudits: KnowledgeDocumentAuditRecord[];
  initialCases: CaseRecord[];
  initialDocuments: KnowledgeDocumentRecord[];
  initialSaleFollowUps: SaleFollowUpRecord[];
  timezone: string;
};

type Workspace = "recovery" | "sales";
type DashboardSection = "dashboard" | Workspace | "documents";

function summarizeNotes(notes: string | null) {
  if (!notes) {
    return "Sin notas.";
  }

  return notes.length > 84 ? `${notes.slice(0, 84)}...` : notes;
}

function getRecoveryStatus(status: string): RecoveryCaseStatus {
  return status === "perdido" ? "perdido" : "agendado";
}

function getDateKeyForTimezone(dateLike: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(dateLike));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function DoorIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M14 4.5H7.75A1.75 1.75 0 0 0 6 6.25v11.5c0 .966.784 1.75 1.75 1.75H14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M11 12h10m0 0-2.75-2.75M21 12l-2.75 2.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="12" fill="currentColor" r="1" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M12 3.25a8.75 8.75 0 0 0-7.64 13.02L3.25 20.75l4.62-1.05A8.75 8.75 0 1 0 12 3.25Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M9.46 8.86c.18-.41.38-.42.56-.43h.47c.15 0 .39.06.59.28.2.22.75.73.75 1.78 0 1.05-.77 2.07-.88 2.21-.11.14-1.51 2.31-3.65 3.24-1.78.78-2.15.62-2.54.58-.39-.04-1.25-.51-1.79-1.1-.55-.59-.97-1.28-1.05-1.42-.08-.14-.7-1.35-.7-2.57 0-1.22.64-1.82.87-2.07.22-.25.49-.31.65-.31h.46c.15 0 .36-.01.56.46.2.48.68 1.66.74 1.78.06.12.1.27.02.44-.08.17-.12.27-.24.41-.12.14-.26.31-.37.41-.12.1-.24.22-.1.43.14.22.63 1.03 1.35 1.67.93.83 1.72 1.09 1.96 1.22.24.12.38.1.52-.06.14-.17.59-.69.75-.93.16-.24.32-.2.54-.12.22.08 1.39.66 1.63.78.24.12.4.18.46.28.06.1.06.57-.13 1.12-.19.55-1.12 1.08-1.56 1.15-.44.06-.99.09-1.6-.11-.37-.12-.84-.27-1.45-.54-2.56-1.11-4.23-3.82-4.36-4-.13-.18-1.04-1.39-1.04-2.66 0-1.27.66-1.9.89-2.15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M4.75 4.75h6.5v6.5h-6.5Zm8.5 0h6v9h-6Zm-8.5 8.5h6.5v6h-6.5Zm8.5 0h6v6h-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RecoveryIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M12 4.75a7.25 7.25 0 1 0 7.25 7.25M12 2.75v4m0 10.5v4m9.25-9.25h-4m-10.5 0h-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" fill="currentColor" r="2.1" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M6 18.25V12m6 6.25V6m6 12.25V9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.75 20.25h14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M8 4.75h6.19L18.25 8.8v10.45A1.75 1.75 0 0 1 16.5 21H8A1.75 1.75 0 0 1 6.25 19.25V6.5A1.75 1.75 0 0 1 8 4.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M14 4.75V9h4.25M9 12.25h6M9 15.75h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShiftIcon({ started }: { started: boolean }) {
  if (started) {
    return (
      <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <path
          d="m6 12.5 4 4 8-9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M8 6.5v11m0-11 9 5.5-9 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function buildWorkspaceCards(input: {
  workspace: Workspace;
  recoverySummary: ReturnType<typeof computeDashboardSummary>;
  salesSummary: ReturnType<typeof computeSalesSummary>;
}) {
  if (input.workspace === "recovery") {
    return [
      {
        key: "open" as RecoveryPreset,
        label: "Abiertos",
        value: input.recoverySummary.openCount,
        hint: "Casos en gestión",
      },
      {
        key: "today" as RecoveryPreset,
        label: "Hoy",
        value: input.recoverySummary.todayScheduled,
        hint: "Agenda activa",
      },
      {
        key: "recovered" as RecoveryPreset,
        label: "Recuperados",
        value: input.recoverySummary.recentRecovered,
        hint: "Últimos 7 días",
      },
      {
        key: "overdue" as RecoveryPreset,
        label: "Vencidos",
        value: input.recoverySummary.overdueCount,
        hint: "Revisar primero",
      },
    ];
  }

  return [
    {
      key: "pending" as SalesPreset,
      label: "Pendientes",
      value: input.salesSummary.pendingCount,
      hint: "Por cerrar",
    },
    {
      key: "sold" as SalesPreset,
      label: "Ventas",
      value: input.salesSummary.soldCount,
      hint: "Confirmadas",
    },
    {
      key: "dropped" as SalesPreset,
      label: "Caídas",
      value: input.salesSummary.droppedCount,
      hint: "Seguimiento perdido",
    },
    {
      key: "today" as SalesPreset,
      label: "Hoy",
      value: input.salesSummary.todayCount,
      hint: "Con fecha objetivo",
    },
  ];
}

export function DashboardShell({
  currentUser,
  dataError,
  initialAudits,
  initialCases,
  initialDocuments,
  initialSaleFollowUps,
  timezone,
}: DashboardShellProps) {
  const router = useRouter();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>("recovery");
  const [activeSection, setActiveSection] = useState<DashboardSection>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [recoveryPreset, setRecoveryPreset] = useState<RecoveryPreset>("all");
  const [salesPreset, setSalesPreset] = useState<SalesPreset>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecoveryCaseStatus | "all">("all");
  const [productFilter, setProductFilter] = useState<ProductType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showRecoveryList, setShowRecoveryList] = useState(initialCases.length > 0);
  const [saleSearch, setSaleSearch] = useState("");
  const [saleProductFilter, setSaleProductFilter] = useState<ProductType | "all">(
    "all",
  );
  const [saleTypeFilter, setSaleTypeFilter] = useState<SaleType | "all">("all");
  const [saleDateFilter, setSaleDateFilter] = useState<SaleDateFilter>("all");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isShiftStarted, setIsShiftStarted] = useState(false);
  const [deletedCaseIds, setDeletedCaseIds] = useState<string[]>([]);
  const [deletedSaleIds, setDeletedSaleIds] = useState<string[]>([]);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [quickCaseStatusId, setQuickCaseStatusId] = useState<string | null>(null);
  const [quickSaleResultId, setQuickSaleResultId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);
  const deferredSaleSearch = useDeferredValue(saleSearch);
  const visibleCases = initialCases.filter(
    (caseItem) => !deletedCaseIds.includes(caseItem.id),
  );
  const visibleSales = initialSaleFollowUps.filter(
    (saleItem) => !deletedSaleIds.includes(saleItem.id),
  );

  const filteredCases = sortCases(
    visibleCases.filter((caseItem) => {
      if (!matchesRecoveryPreset(caseItem, recoveryPreset, timezone)) {
        return false;
      }

      if (statusFilter !== "all" && caseItem.status !== statusFilter) {
        return false;
      }

      if (productFilter !== "all" && caseItem.product_type !== productFilter) {
        return false;
      }

      if (!matchesDateFilter(caseItem, dateFilter, timezone)) {
        return false;
      }

      return matchesSearch(caseItem, deferredSearch);
    }),
  );

  const filteredSales = sortSaleFollowUps(
    visibleSales.filter((saleItem) => {
      if (!matchesSalesPreset(saleItem, salesPreset, timezone)) {
        return false;
      }

      if (
        saleProductFilter !== "all" &&
        saleItem.product_type !== saleProductFilter
      ) {
        return false;
      }

      if (saleTypeFilter !== "all" && saleItem.sale_type !== saleTypeFilter) {
        return false;
      }

      if (!matchesSaleDateFilter(saleItem, saleDateFilter, timezone)) {
        return false;
      }

      return matchesSaleSearch(saleItem, deferredSaleSearch);
    }),
  );

  const effectiveSelectedCaseId =
    selectedCaseId && filteredCases.some((caseItem) => caseItem.id === selectedCaseId)
      ? selectedCaseId
      : null;
  const effectiveSelectedSaleId =
    selectedSaleId && filteredSales.some((saleItem) => saleItem.id === selectedSaleId)
      ? selectedSaleId
      : null;
  const selectedCase =
    visibleCases.find((caseItem) => caseItem.id === effectiveSelectedCaseId) ?? null;
  const selectedSale =
    visibleSales.find((saleItem) => saleItem.id === effectiveSelectedSaleId) ??
    null;
  const selectedCaseStatus = selectedCase ? getRecoveryStatus(selectedCase.status) : null;

  const recoverySummary = computeDashboardSummary(visibleCases, timezone);
  const salesSummary = computeSalesSummary(visibleSales, timezone);
  const todayKey = getDateKeyForTimezone(new Date(), timezone);
  const todayReminderCases = sortCases(
    visibleCases.filter(
      (caseItem) =>
        caseItem.status === "agendado" &&
        caseItem.scheduled_at !== null &&
        getDateKeyForTimezone(caseItem.scheduled_at, timezone) === todayKey,
    ),
  );
  const todayPickupSales = sortSaleFollowUps(
    visibleSales.filter(
      (saleItem) =>
        saleItem.sale_date === todayKey &&
        saleItem.sale_type === "recojo" &&
        saleItem.sale_result === "pendiente",
    ),
  );
  const todayDeliverySales = sortSaleFollowUps(
    visibleSales.filter(
      (saleItem) =>
        saleItem.sale_date === todayKey &&
        saleItem.sale_type === "delivery" &&
        saleItem.sale_result === "pendiente",
    ),
  );
  const todayLogisticsSales = sortSaleFollowUps(
    visibleSales.filter(
      (saleItem) =>
        saleItem.sale_date === todayKey && saleItem.sale_result === "pendiente",
    ),
  );
  const todaySoldCount = visibleSales.filter(
    (saleItem) => saleItem.sale_date === todayKey && saleItem.sale_result === "venta",
  ).length;
  const dashboardMetrics = [
    {
      label: "Recordatorios de hoy",
      value: todayReminderCases.length,
      hint: "Agenda activa",
      tone: "border-sky-200 bg-sky-50/80 text-sky-900",
    },
    {
      label: "Recojos pendientes",
      value: todayPickupSales.length,
      hint: "Por coordinar hoy",
      tone: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    },
    {
      label: "Deliveries pendientes",
      value: todayDeliverySales.length,
      hint: "Por coordinar hoy",
      tone: "border-amber-200 bg-amber-50/80 text-amber-900",
    },
    {
      label: "Ventas confirmadas",
      value: salesSummary.soldCount,
      hint: "Acumulado",
      tone: "border-line bg-white/82 text-foreground",
    },
  ];
  const dashboardBars = [
    {
      label: "Recordatorios",
      value: todayReminderCases.length,
      tone: "bg-sky-500",
    },
    {
      label: "Recojos",
      value: todayPickupSales.length,
      tone: "bg-emerald-500",
    },
    {
      label: "Deliveries",
      value: todayDeliverySales.length,
      tone: "bg-amber-500",
    },
    {
      label: "Ventas hoy",
      value: todaySoldCount,
      tone: "bg-accent",
    },
  ];
  const dashboardBarMax = Math.max(
    1,
    ...dashboardBars.map((dashboardBar) => dashboardBar.value),
  );
  const dashboardAgendaPreview = todayReminderCases.slice(0, 5);
  const dashboardLogisticsPreview = todayLogisticsSales.slice(0, 5);
  const displayName =
    currentUser.name?.trim() || currentUser.email?.split("@")[0] || "Operador";
  const activeCards = buildWorkspaceCards({
    workspace: activeWorkspace,
    recoverySummary,
    salesSummary,
  });
  const sectionTitle =
    activeSection === "dashboard"
      ? "Dashboard operativo"
      : activeSection === "documents"
        ? "Control documental"
      : activeSection === "recovery"
        ? "Recuperación"
        : "Seguimiento de venta";
  const sectionDescription =
    activeSection === "dashboard"
      ? "Prioriza hoy: recordatorios y coordinaciones pendientes en una sola vista."
      : activeSection === "documents"
        ? "Mantén vigente cada diagrama sin salir del mismo workspace."
      : activeSection === "recovery"
        ? "Selecciona un caso y cambia su estado sin entrar a editar."
        : "Cambia el resultado rápido sin entrar a editar.";
  const activeContextLabel =
    activeWorkspace === "recovery"
      ? selectedCase
        ? selectedCase.phone
        : "Sin caso activo"
      : selectedSale
        ? `${selectedSale.phone} · SEC ${selectedSale.sec}`
        : "Sin seguimiento activo";

  async function handleLogout() {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function handleCaseSaved(caseId: string) {
    setSelectedCaseId(caseId);
    setShowRecoveryList(true);

    startTransition(() => {
      router.refresh();
    });
  }

  function handleSaleSaved(saleId: string) {
    setSelectedSaleId(saleId);

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleQuickCaseStatus(nextStatus: RecoveryCaseStatus) {
    if (!selectedCase || quickCaseStatusId || selectedCase.status === nextStatus) {
      return;
    }

    if (nextStatus === "agendado" && !selectedCase.scheduled_at) {
      setActionError("Para marcar agendado, primero define fecha y hora.");
      return;
    }

    setActionError(null);
    setQuickCaseStatusId(selectedCase.id);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("cases")
      .update({
        status: nextStatus,
      })
      .eq("id", selectedCase.id)
      .select("*")
      .single();

    setQuickCaseStatusId(null);

    if (error) {
      setActionError(error.message);
      return;
    }

    handleCaseSaved((data as CaseRecord).id);
  }

  async function handleQuickSaleResult(nextResult: SaleResult) {
    if (!selectedSale || quickSaleResultId || selectedSale.sale_result === nextResult) {
      return;
    }

    setActionError(null);
    setQuickSaleResultId(selectedSale.id);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sale_follow_ups")
      .update({
        sale_result: nextResult,
        ...(nextResult === "caida" ? { picked_up: false } : {}),
      })
      .eq("id", selectedSale.id)
      .select("*")
      .single();

    setQuickSaleResultId(null);

    if (error) {
      setActionError(error.message);
      return;
    }

    handleSaleSaved((data as SaleFollowUpRecord).id);
  }

  async function handleDeleteCase() {
    if (!selectedCase || deletingCaseId) {
      return;
    }

    const confirmed = window.confirm(
      `Se eliminará el caso ${selectedCase.phone}. ¿Deseas continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeletingCaseId(selectedCase.id);

    const supabase = createClient();
    const { error } = await supabase.from("cases").delete().eq("id", selectedCase.id);

    setDeletingCaseId(null);

    if (error) {
      setActionError(error.message);
      return;
    }

    setDeletedCaseIds((current) => [...current, selectedCase.id]);
    setSelectedCaseId(null);
    setShowRecoveryList(true);

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDeleteSale() {
    if (!selectedSale || deletingSaleId) {
      return;
    }

    const confirmed = window.confirm(
      `Se eliminará el seguimiento ${selectedSale.phone} · SEC ${selectedSale.sec}. ¿Deseas continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeletingSaleId(selectedSale.id);

    const supabase = createClient();
    const { error } = await supabase
      .from("sale_follow_ups")
      .delete()
      .eq("id", selectedSale.id);

    setDeletingSaleId(null);

    if (error) {
      setActionError(error.message);
      return;
    }

    setDeletedSaleIds((current) => [...current, selectedSale.id]);
    setSelectedSaleId(null);

    startTransition(() => {
      router.refresh();
    });
  }

  function resetRecoveryFilters() {
    setRecoveryPreset("all");
    setSearch("");
    setStatusFilter("all");
    setProductFilter("all");
    setDateFilter("all");
  }

  function startNewCase() {
    setSelectedCaseId(null);
    setShowRecoveryList(false);
    setActionError(null);
  }

  function openDashboardSection() {
    setActionError(null);
    setActiveSection("dashboard");
    setIsMobileSidebarOpen(false);
  }

  function openRecoverySection() {
    setActionError(null);
    setActiveWorkspace("recovery");
    setActiveSection("recovery");
    setIsMobileSidebarOpen(false);
  }

  function openSalesSection() {
    setActionError(null);
    setActiveWorkspace("sales");
    setActiveSection("sales");
    setIsMobileSidebarOpen(false);
  }

  function openDocumentsSection() {
    setActionError(null);
    setActiveSection("documents");
    setIsMobileSidebarOpen(false);
  }

  function resetSalesFilters() {
    setSalesPreset("all");
    setSaleSearch("");
    setSaleProductFilter("all");
    setSaleTypeFilter("all");
    setSaleDateFilter("all");
  }

  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1680px] pb-24">
        <div className={clsx("flex gap-3", isSidebarCollapsed && "xl:gap-0")}>
          <div
            className={clsx(
              "fixed inset-0 z-40 bg-[#151311]/35 transition xl:hidden",
              isMobileSidebarOpen
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
            )}
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          <aside
            className={clsx(
              "fixed inset-y-3 left-3 z-50 flex w-[min(300px,calc(100vw-1.5rem))] flex-col rounded-[1.6rem] border border-line bg-[rgba(252,250,246,0.98)] shadow-[0_28px_80px_rgba(31,24,18,0.22)] transition-all duration-200 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)] xl:flex-shrink-0 xl:overflow-hidden",
              isMobileSidebarOpen
                ? "translate-x-0 opacity-100"
                : "-translate-x-[108%] opacity-0 xl:translate-x-0 xl:opacity-100",
              isSidebarCollapsed
                ? "xl:w-0 xl:min-w-0 xl:-translate-x-6 xl:opacity-0 xl:pointer-events-none xl:border-transparent xl:bg-transparent xl:shadow-none"
                : "xl:w-[280px]",
            )}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-accent text-white shadow-[0_14px_28px_rgba(11,92,83,0.24)]">
                  <DashboardIcon />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight">Pulse CRM</p>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">
                    Workspace
                  </p>
                </div>
              </div>

              <button
                className="btn-secondary inline-flex h-10 w-10 items-center justify-center xl:hidden"
                onClick={() => setIsMobileSidebarOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 px-3 py-4">
              <div className="px-2 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
                  Workspace
                </p>
              </div>

              <div className="space-y-1.5">
                <button
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm font-semibold transition",
                    activeSection === "dashboard"
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-white/80 hover:text-foreground",
                  )}
                  onClick={openDashboardSection}
                  type="button"
                >
                  <DashboardIcon />
                  <span>Dashboard</span>
                </button>

                <button
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm font-semibold transition",
                    activeSection === "sales"
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-white/80 hover:text-foreground",
                  )}
                  onClick={openSalesSection}
                  type="button"
                >
                  <SalesIcon />
                  <span>Seguimiento de venta</span>
                </button>

                <button
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm font-semibold transition",
                    activeSection === "recovery"
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-white/80 hover:text-foreground",
                  )}
                  onClick={openRecoverySection}
                  type="button"
                >
                  <RecoveryIcon />
                  <span>Recuperación</span>
                </button>
              </div>

              <div className="px-2 pb-2 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
                  Sistema
                </p>
              </div>

              <div className="space-y-1.5">
                <button
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm font-semibold transition",
                    activeSection === "documents"
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-white/80 hover:text-foreground",
                  )}
                  onClick={openDocumentsSection}
                  type="button"
                >
                  <DocumentIcon />
                  <span>Documentación</span>
                </button>

                <button
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm font-semibold text-muted transition hover:bg-white/80 hover:text-foreground",
                  )}
                  disabled={isSigningOut}
                  onClick={handleLogout}
                  type="button"
                >
                  <DoorIcon />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            <section className="panel rounded-[1.5rem] px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-3">
                  <button
                    className="btn-secondary inline-flex h-11 w-11 items-center justify-center xl:hidden"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    type="button"
                  >
                    <MenuIcon />
                  </button>
                  <button
                    className="btn-secondary hidden h-11 w-11 items-center justify-center xl:inline-flex"
                    onClick={() => setIsSidebarCollapsed((current) => !current)}
                    type="button"
                  >
                    <MenuIcon />
                  </button>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-accent-strong">
                      Pulse CRM
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                      {sectionTitle}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-7 muted-text">
                      {sectionDescription}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="rounded-[1rem] border border-line bg-white/74 px-4 py-2.5 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                      Usuario
                    </p>
                    <p className="mt-1 font-semibold">{displayName}</p>
                  </div>

                  <button
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition",
                      isShiftStarted
                        ? "border border-emerald-300 bg-emerald-100 text-emerald-900 shadow-[0_12px_24px_rgba(16,120,82,0.18)]"
                        : "btn-secondary",
                    )}
                    onClick={() => setIsShiftStarted(true)}
                    type="button"
                  >
                    <ShiftIcon started={isShiftStarted} />
                    {isShiftStarted ? "Jornada iniciada" : "Inicio de jornada"}
                  </button>
                </div>
              </div>

              {dataError ? (
                <div className="mt-4 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {dataError}
                </div>
              ) : null}

              {actionError ? (
                <div className="mt-4 rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {actionError}
                </div>
              ) : null}

              {activeSection === "dashboard" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {dashboardMetrics.map((metric) => (
                    <article
                      className={clsx(
                        "rounded-[1.15rem] border px-4 py-3 shadow-[0_16px_32px_rgba(26,20,15,0.04)]",
                        metric.tone,
                      )}
                      key={metric.label}
                    >
                      <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">
                        {metric.label}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
                        <p className="text-right text-xs opacity-70">{metric.hint}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {activeCards.map((card) => {
                    const isActive =
                      activeWorkspace === "recovery"
                        ? recoveryPreset === card.key
                        : salesPreset === card.key;

                    return (
                      <button
                        className={clsx(
                          "rounded-[1.15rem] border px-4 py-3 text-left transition",
                          isActive
                            ? "border-accent-strong bg-white shadow-lg"
                            : "border-line bg-white/76 hover:border-line-strong hover:bg-white",
                        )}
                        key={card.label}
                        onClick={() => {
                          if (activeWorkspace === "recovery") {
                            setRecoveryPreset((current) =>
                              current === card.key ? "all" : (card.key as RecoveryPreset),
                            );
                            return;
                          }

                          setSalesPreset((current) =>
                            current === card.key ? "all" : (card.key as SalesPreset),
                          );
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                            {card.label}
                          </p>
                          <p className="text-[11px] font-semibold text-accent-strong">
                            {isActive ? "Activo" : "Filtrar"}
                          </p>
                        </div>
                        <div className="mt-2 flex items-end justify-between gap-3">
                          <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                          <p className="text-xs muted-text">{card.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {activeSection === "dashboard" ? (
              <section className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <article className="panel rounded-[1.5rem] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
                        Pulso del día
                      </p>
                      <h2 className="mt-1.5 text-xl font-semibold">Vista rápida de hoy</h2>
                      <p className="mt-2 text-sm leading-7 muted-text">
                        Lee en segundos cómo viene la agenda, las coordinaciones pendientes y el cierre comercial.
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-line bg-white/78 px-4 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        Ventas hoy
                      </p>
                      <p className="mt-1 text-2xl font-semibold">{todaySoldCount}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="grid h-[260px] grid-cols-4 items-end gap-3 rounded-[1.2rem] border border-line bg-white/72 px-4 pb-4 pt-6">
                      {dashboardBars.map((dashboardBar) => {
                        const height = Math.max(
                          14,
                          Math.round((dashboardBar.value / dashboardBarMax) * 100),
                        );

                        return (
                          <div
                            className="flex h-full flex-col items-center justify-end gap-3"
                            key={dashboardBar.label}
                          >
                            <span className="text-sm font-semibold">{dashboardBar.value}</span>
                            <div className="flex h-[170px] items-end">
                              <div
                                className={clsx(
                                  "w-12 rounded-t-[1rem] shadow-[0_16px_28px_rgba(26,20,15,0.12)] transition-all",
                                  dashboardBar.tone,
                                )}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <span className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                              {dashboardBar.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2 rounded-[1.2rem] border border-line bg-white/72 p-4">
                      <div className="rounded-[1rem] border border-sky-200 bg-sky-50/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700">
                          Agenda
                        </p>
                        <p className="mt-1 font-semibold text-sky-950">
                          {todayReminderCases.length} recordatorios activos
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">
                          Recojos
                        </p>
                        <p className="mt-1 font-semibold text-emerald-950">
                          {todayPickupSales.length} pendientes
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-amber-200 bg-amber-50/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700">
                          Delivery
                        </p>
                        <p className="mt-1 font-semibold text-amber-950">
                          {todayDeliverySales.length} pendientes
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-line bg-background/50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                          Cierre comercial
                        </p>
                        <p className="mt-1 font-semibold">
                          {salesSummary.soldCount} ventas confirmadas
                        </p>
                      </div>
                    </div>
                  </div>
                </article>

                <div className="space-y-3">
                  <article className="panel rounded-[1.5rem] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
                          Agenda de hoy
                        </p>
                        <h2 className="mt-1.5 text-xl font-semibold">
                          Recordatorios del día
                        </h2>
                      </div>
                      <button
                        className="btn-secondary px-4 py-2.5 text-sm font-semibold"
                        onClick={() => {
                          setRecoveryPreset("today");
                          setShowRecoveryList(true);
                          openRecoverySection();
                        }}
                        type="button"
                      >
                        Abrir recuperación
                      </button>
                    </div>

                    {dashboardAgendaPreview.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {dashboardAgendaPreview.map((caseItem) => (
                          <button
                            className="w-full rounded-[1rem] border border-line bg-white/76 px-4 py-3 text-left transition hover:border-line-strong hover:bg-white"
                            key={caseItem.id}
                            onClick={() => {
                              setSelectedCaseId(caseItem.id);
                              setShowRecoveryList(true);
                              openRecoverySection();
                            }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{caseItem.phone}</p>
                                <p className="mt-1 text-xs muted-text">
                                  {PRODUCT_LABELS[caseItem.product_type]}
                                </p>
                              </div>
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                                {formatDateTime(caseItem.scheduled_at, timezone)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm muted-text">
                              {summarizeNotes(caseItem.notes)}
                            </p>
                          </button>
                        ))}
                        {todayReminderCases.length > dashboardAgendaPreview.length ? (
                          <p className="px-1 text-xs muted-text">
                            +{todayReminderCases.length - dashboardAgendaPreview.length} recordatorios más en recuperación.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[1.1rem] border border-dashed border-line px-4 py-6 text-sm muted-text">
                        No tienes recordatorios para hoy.
                      </div>
                    )}
                  </article>

                  <article className="panel rounded-[1.5rem] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
                          Logística de hoy
                        </p>
                        <h2 className="mt-1.5 text-xl font-semibold">
                          Pendientes por coordinar
                        </h2>
                      </div>
                      <button
                        className="btn-secondary px-4 py-2.5 text-sm font-semibold"
                        onClick={() => {
                          setSalesPreset("today");
                          openSalesSection();
                        }}
                        type="button"
                      >
                        Abrir seguimiento
                      </button>
                    </div>

                    {dashboardLogisticsPreview.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {dashboardLogisticsPreview.map((saleItem) => (
                          <button
                            className="w-full rounded-[1rem] border border-line bg-white/76 px-4 py-3 text-left transition hover:border-line-strong hover:bg-white"
                            key={saleItem.id}
                            onClick={() => {
                              setSelectedSaleId(saleItem.id);
                              openSalesSection();
                            }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{saleItem.phone}</p>
                                <p className="mt-1 text-xs muted-text">
                                  {PRODUCT_LABELS[saleItem.product_type]} · SEC {saleItem.sec}
                                </p>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <span
                                  className={clsx(
                                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                    SALE_TYPE_TONES[saleItem.sale_type],
                                  )}
                                >
                                  {SALE_TYPE_LABELS[saleItem.sale_type]}
                                </span>
                                <span
                                  className={clsx(
                                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                    SALE_RESULT_TONES[saleItem.sale_result],
                                  )}
                                >
                                  {SALE_RESULT_LABELS[saleItem.sale_result]}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-sm muted-text">
                              {formatCalendarDate(saleItem.sale_date)} · {saleItem.for_when}
                            </p>
                          </button>
                        ))}
                        {todayLogisticsSales.length > dashboardLogisticsPreview.length ? (
                          <p className="px-1 text-xs muted-text">
                            +{todayLogisticsSales.length - dashboardLogisticsPreview.length} pendientes más en seguimiento.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[1.1rem] border border-dashed border-line px-4 py-6 text-sm muted-text">
                        No tienes recojos ni deliveries pendientes para hoy.
                      </div>
                    )}
                  </article>
                </div>
              </section>
            ) : activeSection === "documents" ? (
              <KnowledgeSettingsShell
                currentUser={currentUser}
                dataError={dataError}
                initialAudits={initialAudits}
                initialDocuments={initialDocuments}
                timezone={timezone}
              />
            ) : activeWorkspace === "recovery" ? (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1.58fr)_430px]">
            <div className="space-y-3">
              <section className="panel rounded-[1.5rem] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Recuperación</h2>
                    <p className="mt-1 text-sm muted-text">
                      Selecciona un caso y cambia su estado sin entrar a editar.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-[1rem] border border-line bg-white/74 px-4 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        Registro activo
                      </p>
                      <p className="mt-1 font-semibold">
                        {selectedCase
                          ? `${selectedCase.phone} · ${PRODUCT_LABELS[selectedCase.product_type]}`
                          : "Nuevo caso"}
                      </p>
                    </div>
                    <button
                      className="btn-secondary px-4 py-3 text-sm font-semibold"
                      onClick={() => setShowRecoveryList((current) => !current)}
                      type="button"
                    >
                      {showRecoveryList ? "Ocultar casos" : "Ver casos"}
                    </button>
                    <button
                      className="btn-primary px-4 py-3 text-sm font-semibold"
                      onClick={startNewCase}
                      type="button"
                    >
                      Nuevo caso
                    </button>
                  </div>
                </div>

                {showRecoveryList ? (
                  <>
                    <div className="mt-4 grid gap-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
                      <input
                        className="field"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por número o producto"
                        value={search}
                      />
                      <select
                        className="field"
                        onChange={(event) =>
                          setStatusFilter(event.target.value as RecoveryCaseStatus | "all")
                        }
                        value={statusFilter}
                      >
                        <option value="all">Estado</option>
                        {RECOVERY_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="field"
                        onChange={(event) =>
                          setProductFilter(event.target.value as ProductType | "all")
                        }
                        value={productFilter}
                      >
                        <option value="all">Producto</option>
                        {PRODUCT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="field"
                        onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                        value={dateFilter}
                      >
                        {DATE_FILTER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 rounded-[1rem] border border-line bg-white/74 px-3 py-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                            Cambio rápido
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {selectedCase
                              ? `${selectedCase.phone} · ${STATUS_LABELS[selectedCaseStatus!]}`
                              : "Selecciona un caso para cambiar estado"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {RECOVERY_STATUS_OPTIONS.map((option) => {
                            const isCurrent = selectedCaseStatus === option.value;

                            return (
                              <button
                                className={clsx(
                                  "rounded-full px-3 py-2 text-xs font-semibold transition",
                                  isCurrent
                                    ? "border border-accent-strong bg-accent-soft text-accent-strong"
                                    : "btn-secondary",
                                )}
                                disabled={!selectedCase || quickCaseStatusId === selectedCase.id}
                                key={option.value}
                                onClick={() => {
                                  void handleQuickCaseStatus(option.value);
                                }}
                                type="button"
                              >
                                {quickCaseStatusId === selectedCase?.id && isCurrent
                                  ? "Actualizando..."
                                  : STATUS_LABELS[option.value]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <p className="muted-text">
                        {filteredCases.length} {filteredCases.length === 1 ? "caso visible" : "casos visibles"}
                        {recoveryPreset !== "all" ? ` · ${RECOVERY_PRESET_LABELS[recoveryPreset]}` : ""}
                      </p>
                      <button
                        className="text-sm font-semibold text-accent-strong"
                        onClick={resetRecoveryFilters}
                        type="button"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-[1rem] border border-dashed border-line-strong bg-white/60 px-4 py-4 text-sm">
                    <p className="font-semibold">Modo nuevo caso</p>
                    <p className="mt-1 muted-text">
                      La lista se oculta para que te enfoques en agendar el nuevo registro. Usa
                      ` Ver casos ` si necesitas consultar o editar uno existente.
                    </p>
                  </div>
                )}
              </section>

              {showRecoveryList ? (
                <section className="panel rounded-[1.5rem] p-2 sm:p-3">
                  <div className="space-y-2">
                    {filteredCases.length ? (
                      filteredCases.map((caseItem) => {
                        const isActive = caseItem.id === effectiveSelectedCaseId;
                        const caseStatus = getRecoveryStatus(caseItem.status);
                        const recoveryWhatsAppUrl = buildRecoveryWhatsAppUrl(
                          caseItem,
                          timezone,
                        );

                        return (
                          <article
                            className={clsx(
                              "rounded-[1.2rem] border px-4 py-3 transition",
                              isActive
                                ? "border-accent-strong bg-white shadow-lg"
                                : "border-line bg-white/70 hover:border-line-strong hover:bg-white",
                            )}
                            key={caseItem.id}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <button
                                aria-pressed={isActive}
                                className="min-w-0 flex-1 text-left"
                                onClick={() => {
                                  setSelectedCaseId(caseItem.id);
                                  setShowRecoveryList(true);
                                }}
                                type="button"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONES[caseStatus]}`}
                                    >
                                      {STATUS_LABELS[caseStatus]}
                                    </span>
                                    <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground">
                                      {PRODUCT_LABELS[caseItem.product_type]}
                                    </span>
                                    <span className="text-[11px] text-muted">
                                      {caseItem.scheduled_at
                                        ? `Agenda ${formatDateTime(caseItem.scheduled_at, timezone)}`
                                        : "Sin agenda"}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid gap-1">
                                    <p className="font-mono text-base font-semibold">
                                      {caseItem.phone}
                                    </p>
                                    <p className="text-sm leading-6 text-muted">
                                      {summarizeNotes(caseItem.notes)}
                                    </p>
                                  </div>
                                </div>
                              </button>

                              <div className="flex flex-col gap-2 lg:min-w-[182px]">
                                <div className="rounded-[1rem] border border-line bg-white/78 px-3 py-2 text-left lg:text-right">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                                    Actualizado
                                  </p>
                                  <p className="mt-1 text-sm font-semibold">
                                    {formatDateTime(caseItem.updated_at, timezone)}
                                  </p>
                                </div>
                                <a
                                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(22,101,52,0.24)] transition hover:-translate-y-px hover:bg-emerald-700"
                                  href={recoveryWhatsAppUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  <WhatsAppIcon />
                                  WhatsApp
                                </a>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-[1.2rem] border border-dashed border-line-strong bg-white/60 px-4 py-10 text-center">
                        <p className="text-base font-semibold">Sin casos para esos filtros.</p>
                        <p className="mt-1 text-sm muted-text">
                          Ajusta filtros o abre un caso nuevo.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            <div className="space-y-3">
              <CaseForm
                isDeleting={deletingCaseId === selectedCase?.id}
                onDelete={handleDeleteCase}
                onSaved={handleCaseSaved}
                onStartFresh={startNewCase}
                selectedCase={selectedCase}
                timezone={timezone}
              />
            </div>
          </section>
        ) : (
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1.58fr)_430px]">
            <div className="space-y-3">
              <section className="panel rounded-[1.5rem] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Seguimiento de venta</h2>
                    <p className="mt-1 text-sm muted-text">
                      Cambia el resultado rápido sin entrar a editar.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-[1rem] border border-line bg-white/74 px-4 py-3 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        Seguimiento activo
                      </p>
                      <p className="mt-1 font-semibold">
                        {selectedSale
                          ? `${selectedSale.phone} · ${PRODUCT_LABELS[selectedSale.product_type]}`
                          : "Nuevo seguimiento"}
                      </p>
                    </div>
                    <button
                      className="btn-primary px-4 py-3 text-sm font-semibold"
                      onClick={() => setSelectedSaleId(null)}
                      type="button"
                    >
                      Nuevo seguimiento
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
                  <input
                    className="field"
                    onChange={(event) => setSaleSearch(event.target.value)}
                    placeholder="Buscar por número, SEC o para cuándo"
                    value={saleSearch}
                  />
                  <select
                    className="field"
                    onChange={(event) =>
                      setSaleProductFilter(event.target.value as ProductType | "all")
                    }
                    value={saleProductFilter}
                  >
                    <option value="all">Producto</option>
                    {PRODUCT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    onChange={(event) =>
                      setSaleTypeFilter(event.target.value as SaleType | "all")
                    }
                    value={saleTypeFilter}
                  >
                    <option value="all">Tipo de venta</option>
                    {SALE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    onChange={(event) =>
                      setSaleDateFilter(event.target.value as SaleDateFilter)
                    }
                    value={saleDateFilter}
                  >
                    {SALE_DATE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 rounded-[1rem] border border-line bg-white/74 px-3 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        Resultado rápido
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {selectedSale
                          ? `${selectedSale.phone} · ${SALE_RESULT_LABELS[selectedSale.sale_result]}`
                          : "Selecciona un seguimiento para cambiar resultado"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SALE_RESULT_OPTIONS.map((option) => {
                        const isCurrent = selectedSale?.sale_result === option.value;

                        return (
                          <button
                            className={clsx(
                              "rounded-full px-3 py-2 text-xs font-semibold transition",
                              isCurrent
                                ? "border border-accent-strong bg-accent-soft text-accent-strong"
                                : "btn-secondary",
                            )}
                            disabled={!selectedSale || quickSaleResultId === selectedSale.id}
                            key={option.value}
                            onClick={() => {
                              void handleQuickSaleResult(option.value);
                            }}
                            type="button"
                          >
                            {quickSaleResultId === selectedSale?.id && isCurrent
                              ? "Actualizando..."
                              : SALE_RESULT_LABELS[option.value]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="muted-text">
                    {filteredSales.length}{" "}
                    {filteredSales.length === 1 ? "seguimiento visible" : "seguimientos visibles"}
                    {salesPreset !== "all" ? ` · ${SALES_PRESET_LABELS[salesPreset]}` : ""}
                  </p>
                  <button
                    className="text-sm font-semibold text-accent-strong"
                    onClick={resetSalesFilters}
                    type="button"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </section>

              <section className="panel rounded-[1.5rem] p-2 sm:p-3">
                <div className="space-y-2">
                    {filteredSales.length ? (
                      filteredSales.map((saleItem) => {
                        const isActive = saleItem.id === effectiveSelectedSaleId;
                        const saleWhatsAppUrl = buildSaleWhatsAppUrl(
                          saleItem,
                          timezone,
                        );

                      return (
                        <article
                          className={clsx(
                            "rounded-[1.2rem] border px-4 py-3 transition",
                            isActive
                              ? "border-accent-strong bg-white shadow-lg"
                              : "border-line bg-white/70 hover:border-line-strong hover:bg-white",
                          )}
                          key={saleItem.id}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <button
                              aria-pressed={isActive}
                              className="min-w-0 flex-1 text-left"
                              onClick={() => setSelectedSaleId(saleItem.id)}
                              type="button"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground">
                                    {PRODUCT_LABELS[saleItem.product_type]}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SALE_TYPE_TONES[saleItem.sale_type]}`}
                                  >
                                    {SALE_TYPE_LABELS[saleItem.sale_type]}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SALE_RESULT_TONES[saleItem.sale_result]}`}
                                  >
                                    {SALE_RESULT_LABELS[saleItem.sale_result]}
                                  </span>
                                  <span className="text-[11px] text-muted">
                                    {formatCalendarDate(saleItem.sale_date)}
                                  </span>
                                </div>

                                <div className="mt-3 grid gap-1">
                                  <p className="truncate text-base font-semibold">
                                    {saleItem.phone}
                                  </p>
                                  <p className="text-sm font-medium text-muted">
                                    SEC {saleItem.sec}
                                  </p>
                                  <p className="text-sm leading-6 text-muted">
                                    {saleItem.for_when}
                                  </p>
                                </div>
                              </div>
                            </button>

                            <div className="flex flex-col gap-2 lg:min-w-[182px]">
                              <div className="rounded-[1rem] border border-line bg-white/78 px-3 py-2 text-left lg:text-right">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                                  Actualizado
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  {formatDateTime(saleItem.updated_at, timezone)}
                                </p>
                              </div>
                              <a
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(22,101,52,0.24)] transition hover:-translate-y-px hover:bg-emerald-700"
                                href={saleWhatsAppUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <WhatsAppIcon />
                                WhatsApp
                              </a>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-line-strong bg-white/60 px-4 py-10 text-center">
                      <p className="text-base font-semibold">
                        Sin seguimientos para esos filtros.
                      </p>
                      <p className="mt-1 text-sm muted-text">
                        Ajusta filtros o registra un nuevo seguimiento.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-3">
              <SaleFollowUpForm
                isDeleting={deletingSaleId === selectedSale?.id}
                onDelete={handleDeleteSale}
                onSaved={handleSaleSaved}
                onStartFresh={() => setSelectedSaleId(null)}
                selectedSale={selectedSale}
              />
            </div>
          </section>
        )}

        <QuickHelpSheet activeContextLabel={activeContextLabel} />
      </div>
        </div>
      </div>
    </main>
  );
}
