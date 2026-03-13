import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  KNOWLEDGE_DOCUMENT_AUDIT_SELECT,
  KNOWLEDGE_DOCUMENT_SELECT,
} from "@/lib/knowledge-server";
import { createClient } from "@/lib/supabase/server";
import type {
  CaseRecord,
  KnowledgeDocumentAuditRecord,
  KnowledgeDocumentRecord,
  ProfileRecord,
  SaleFollowUpRecord,
} from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile, error: profileError },
    { data: cases, error: casesError },
    { data: sales, error: salesError },
    { data: documents, error: documentsError },
    { data: audits, error: auditsError },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("cases")
        .select(
          "id, user_id, customer_name, phone, product_type, status, scheduled_at, notes, created_at, updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("sale_follow_ups")
        .select(
          "id, user_id, phone, sec, product_type, sale_type, sale_result, picked_up, for_when, sale_date, created_at, updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("knowledge_documents")
        .select(KNOWLEDGE_DOCUMENT_SELECT)
        .order("updated_at", { ascending: false }),
      supabase
        .from("knowledge_document_audits")
        .select(KNOWLEDGE_DOCUMENT_AUDIT_SELECT)
        .order("created_at", { ascending: false }),
    ]);

  const dataError =
    [
      profileError?.message,
      casesError?.message,
      salesError?.message,
      documentsError?.message,
      auditsError?.message,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <DashboardShell
      currentUser={{
        email: user.email ?? (profile as ProfileRecord | null)?.email ?? null,
        name:
          (profile as ProfileRecord | null)?.full_name ??
          (typeof user.user_metadata.full_name === "string"
            ? user.user_metadata.full_name
            : null),
      }}
      initialAudits={(audits ?? []) as KnowledgeDocumentAuditRecord[]}
      dataError={dataError}
      initialCases={(cases ?? []) as CaseRecord[]}
      initialDocuments={(documents ?? []) as KnowledgeDocumentRecord[]}
      initialSaleFollowUps={(sales ?? []) as SaleFollowUpRecord[]}
      timezone={DEFAULT_TIMEZONE}
    />
  );
}
