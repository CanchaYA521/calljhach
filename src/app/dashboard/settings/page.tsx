import Link from "next/link";
import { redirect } from "next/navigation";

import { KnowledgeSettingsShell } from "@/components/dashboard/knowledge-settings-shell";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  KNOWLEDGE_DOCUMENT_AUDIT_SELECT,
  KNOWLEDGE_DOCUMENT_SELECT,
} from "@/lib/knowledge-server";
import { createClient } from "@/lib/supabase/server";
import type {
  KnowledgeDocumentAuditRecord,
  KnowledgeDocumentRecord,
  ProfileRecord,
} from "@/lib/types";

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile, error: profileError },
    { data: documents, error: documentsError },
    { data: audits, error: auditsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .eq("id", user.id)
      .maybeSingle(),
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
    [profileError?.message, documentsError?.message, auditsError?.message]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="panel rounded-[1.7rem] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-accent-strong">
                Pulse CRM
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Control documental
              </h1>
              <p className="mt-1 text-sm muted-text">
                Mantén vigente cada diagrama y revisa cuándo fue actualizado.
              </p>
            </div>
            <Link className="btn-secondary px-4 py-3 text-sm font-semibold" href="/dashboard">
              Volver al panel
            </Link>
          </div>
        </section>

        <KnowledgeSettingsShell
          currentUser={{
            email: user.email ?? (profile as ProfileRecord | null)?.email ?? null,
            name:
              (profile as ProfileRecord | null)?.full_name ??
              (typeof user.user_metadata.full_name === "string"
                ? user.user_metadata.full_name
                : null),
          }}
          dataError={dataError}
          initialAudits={(audits ?? []) as KnowledgeDocumentAuditRecord[]}
          initialDocuments={(documents ?? []) as KnowledgeDocumentRecord[]}
          timezone={DEFAULT_TIMEZONE}
        />
      </div>
    </main>
  );
}
