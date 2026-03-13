"use client";

import clsx from "clsx";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { readApiResponse } from "@/lib/http";
import {
  getKnowledgeFileTooLargeMessage,
  isKnowledgeFileTooLarge,
  isKnowledgeUploadTooLargeMessage,
  MAX_KNOWLEDGE_FILE_SIZE_LABEL,
} from "@/lib/knowledge-upload";
import {
  KNOWLEDGE_AUDIT_ACTION_LABELS,
  KNOWLEDGE_PRODUCT_LABELS,
  KNOWLEDGE_PRODUCT_OPTIONS,
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_STATUS_TONES,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/cases";
import { formatFileSize } from "@/lib/knowledge";
import type {
  KnowledgeDocumentAuditRecord,
  KnowledgeDocumentRecord,
  KnowledgeProductType,
} from "@/lib/types";

type KnowledgeSettingsShellProps = {
  currentUser: {
    email: string | null;
    name: string | null;
  };
  dataError: string | null;
  initialAudits: KnowledgeDocumentAuditRecord[];
  initialDocuments: KnowledgeDocumentRecord[];
  timezone: string;
};

function getDefaultSelectedDocumentId(documents: KnowledgeDocumentRecord[]) {
  return documents[0]?.id ?? null;
}

function getUploadErrorMessage(message: string | undefined, fallback: string) {
  if (message && isKnowledgeUploadTooLargeMessage(message)) {
    return getKnowledgeFileTooLargeMessage();
  }

  return message ?? fallback;
}

export function KnowledgeSettingsShell({
  currentUser,
  dataError,
  initialAudits,
  initialDocuments,
  timezone,
}: KnowledgeSettingsShellProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [audits, setAudits] = useState(initialAudits);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    getDefaultSelectedDocumentId(initialDocuments),
  );
  const [title, setTitle] = useState("");
  const [productType, setProductType] = useState<KnowledgeProductType>("general");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateProductType, setUpdateProductType] =
    useState<KnowledgeProductType>("general");
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    setAudits(initialAudits);
  }, [initialAudits]);

  useEffect(() => {
    if (
      selectedDocumentId &&
      documents.some((document) => document.id === selectedDocumentId)
    ) {
      return;
    }

    setSelectedDocumentId(getDefaultSelectedDocumentId(documents));
  }, [documents, selectedDocumentId]);

  const selectedDocument =
    documents.find((document) => document.id === selectedDocumentId) ?? null;
  const selectedDocumentAudits = audits.filter(
    (audit) => audit.document_id === selectedDocumentId,
  );
  const displayName =
    currentUser.name?.trim() || currentUser.email?.split("@")[0] || "Operador";

  useEffect(() => {
    if (!selectedDocument) {
      setUpdateTitle("");
      setUpdateProductType("general");
      setUpdateFile(null);
      setUpdateError(null);
      return;
    }

    setUpdateTitle(selectedDocument.title);
    setUpdateProductType(selectedDocument.product_type);
    setUpdateFile(null);
    setUpdateError(null);
  }, [selectedDocument]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setDocumentActionError(null);

    if (!selectedFile) {
      setUploadError("Selecciona un archivo antes de subirlo.");
      return;
    }

    if (isKnowledgeFileTooLarge(selectedFile)) {
      setUploadError(getKnowledgeFileTooLargeMessage());
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("title", title.trim() || selectedFile.name.replace(/\.[^.]+$/, ""));
      formData.set("product_type", productType);
      formData.set("file", selectedFile);

      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await readApiResponse<{
        error?: string;
        document?: KnowledgeDocumentRecord | null;
        audit?: KnowledgeDocumentAuditRecord | null;
      }>(response, "No se pudo procesar el archivo.");

      if (payload.document) {
        setDocuments((current) => [
          payload.document!,
          ...current.filter((document) => document.id !== payload.document!.id),
        ]);
        setSelectedDocumentId(payload.document.id);
      }

      if (payload.audit) {
        setAudits((current) => [payload.audit!, ...current]);
      }

      if (!response.ok) {
        setUploadError(
          getUploadErrorMessage(payload.error, "No se pudo procesar el archivo."),
        );
        return;
      }

      setTitle("");
      setProductType("general");
      setSelectedFile(null);
      router.refresh();
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "No se pudo subir el archivo.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateError(null);
    setDocumentActionError(null);

    if (!selectedDocument) {
      setUpdateError("Selecciona un diagrama antes de actualizarlo.");
      return;
    }

    if (!updateFile) {
      setUpdateError("Selecciona el nuevo archivo para reemplazar el diagrama vigente.");
      return;
    }

    if (isKnowledgeFileTooLarge(updateFile)) {
      setUpdateError(getKnowledgeFileTooLargeMessage());
      return;
    }

    setUpdatingDocumentId(selectedDocument.id);

    try {
      const formData = new FormData();
      formData.set("title", updateTitle.trim() || selectedDocument.title);
      formData.set("product_type", updateProductType);
      formData.set("file", updateFile);

      const response = await fetch(`/api/knowledge/documents/${selectedDocument.id}`, {
        method: "PATCH",
        body: formData,
      });
      const payload = await readApiResponse<{
        error?: string;
        document?: KnowledgeDocumentRecord | null;
        audit?: KnowledgeDocumentAuditRecord | null;
      }>(response, "No se pudo actualizar el diagrama.");

      if (!response.ok || !payload.document) {
        throw new Error(
          getUploadErrorMessage(payload.error, "No se pudo actualizar el diagrama."),
        );
      }

      setDocuments((current) =>
        current.map((document) =>
          document.id === payload.document!.id ? payload.document! : document,
        ),
      );

      if (payload.audit) {
        setAudits((current) => [payload.audit!, ...current]);
      }

      setUpdateFile(null);
      router.refresh();
    } catch (error) {
      setUpdateError(
        error instanceof Error ? error.message : "No se pudo actualizar el diagrama.",
      );
    } finally {
      setUpdatingDocumentId(null);
    }
  }

  async function handleDeleteDocument(document: KnowledgeDocumentRecord) {
    if (deletingDocumentId) {
      return;
    }

    const confirmed = window.confirm(
      `Se eliminará "${document.title}" junto con su archivo e historial. ¿Deseas continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setDocumentActionError(null);
    setDeletingDocumentId(document.id);

    try {
      const response = await fetch(`/api/knowledge/documents/${document.id}`, {
        method: "DELETE",
      });
      const payload = await readApiResponse<{
        error?: string;
        documentId?: string;
      }>(response, "No se pudo borrar el diagrama.");

      if (!response.ok || !payload.documentId) {
        throw new Error(payload.error ?? "No se pudo borrar el diagrama.");
      }

      setDocuments((current) =>
        current.filter((currentDocument) => currentDocument.id !== payload.documentId),
      );
      setAudits((current) =>
        current.filter((audit) => audit.document_id !== payload.documentId),
      );
      router.refresh();
    } catch (error) {
      setDocumentActionError(
        error instanceof Error ? error.message : "No se pudo borrar el diagrama.",
      );
    } finally {
      setDeletingDocumentId(null);
    }
  }

  function jumpToMaintenance(documentId: string) {
    setSelectedDocumentId(documentId);
    setDocumentActionError(null);
    document.getElementById("document-maintenance-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="panel rounded-[1.6rem] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
                Base documental
              </p>
              <h2 className="mt-1.5 text-xl font-semibold">Alta de diagrama</h2>
              <p className="mt-1 text-sm muted-text">
                Sube la versión vigente y úsala luego desde la ayuda rápida del panel.
              </p>
            </div>
            <div className="rounded-[1.1rem] border border-line bg-white/72 px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Usuario</p>
              <p className="mt-1 text-sm font-semibold">{displayName}</p>
            </div>
          </div>

          {dataError ? (
            <div className="mt-4 rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {dataError}
            </div>
          ) : null}

          <form className="mt-4 space-y-3" onSubmit={handleUpload}>
            <div>
              <label className="label" htmlFor="knowledge_title">
                Título
              </label>
              <input
                className="field"
                id="knowledge_title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Portabilidad marzo 2026"
                value={title}
              />
            </div>

            <div>
              <label className="label" htmlFor="knowledge_product_type">
                Producto
              </label>
              <select
                className="field"
                id="knowledge_product_type"
                onChange={(event) =>
                  setProductType(event.target.value as KnowledgeProductType)
                }
                value={productType}
              >
                {KNOWLEDGE_PRODUCT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="knowledge_file">
                Archivo
              </label>
              <input
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.xlsx,.xlsm"
                className="field file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:font-semibold"
                id="knowledge_file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <p className="mt-1 text-xs muted-text">
                Límite {MAX_KNOWLEDGE_FILE_SIZE_LABEL}. Si un flujo de Excel está armado con formas, exportarlo a PDF suele dar un mejor resultado.
              </p>
            </div>

            {uploadError ? (
              <div className="rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {uploadError}
              </div>
            ) : null}

            <button
              className="btn-primary w-full px-5 py-3 text-sm font-semibold"
              disabled={isUploading}
              type="submit"
            >
              {isUploading ? "Subiendo y procesando..." : "Subir diagrama"}
            </button>
          </form>
        </section>

        <section className="panel rounded-[1.6rem] p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-semibold">Vigentes</h2>
              <p className="mt-1 text-sm muted-text">
                {documents.length} {documents.length === 1 ? "documento" : "documentos"}
              </p>
            </div>
          </div>

          {documentActionError ? (
            <div className="mb-3 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {documentActionError}
            </div>
          ) : null}

          <div className="space-y-2">
            {documents.length ? (
              documents.map((document) => {
                const isActive = selectedDocumentId === document.id;
                const isDeleting = deletingDocumentId === document.id;

                return (
                  <article
                    className={clsx(
                      "rounded-[1.25rem] border px-4 py-3 transition",
                      isActive
                        ? "border-accent-strong bg-white shadow-lg"
                        : "border-line bg-white/70 hover:border-line-strong hover:bg-white",
                    )}
                    key={document.id}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => setSelectedDocumentId(document.id)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground">
                          {KNOWLEDGE_PRODUCT_LABELS[document.product_type]}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${KNOWLEDGE_STATUS_TONES[document.status]}`}
                        >
                          {KNOWLEDGE_STATUS_LABELS[document.status]}
                        </span>
                        <span className="text-[11px] text-muted">
                          {formatFileSize(document.file_size_bytes)}
                        </span>
                      </div>

                      <p className="mt-3 text-base font-semibold">{document.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {document.summary ?? document.processing_error ?? "Sin resumen todavía."}
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted">
                        {document.file_name} · actualizado{" "}
                        {formatDateTime(document.updated_at, timezone)}
                      </p>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="btn-secondary px-3 py-2 text-sm font-semibold"
                        onClick={() => jumpToMaintenance(document.id)}
                        type="button"
                      >
                        Actualizar
                      </button>
                      <button
                        className="btn-secondary px-3 py-2 text-sm font-semibold text-danger"
                        disabled={isDeleting}
                        onClick={() => handleDeleteDocument(document)}
                        type="button"
                      >
                        {isDeleting ? "Borrando..." : "Eliminar"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-line-strong bg-white/60 px-4 py-8 text-center">
                <p className="text-base font-semibold">Todavía no hay diagramas vigentes.</p>
                <p className="mt-1 text-sm muted-text">
                  Sube el primero para habilitar ayuda rápida por producto.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="panel rounded-[1.6rem] p-4 sm:p-5" id="document-maintenance-panel">
          {selectedDocument ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
                    Mantenimiento
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold">{selectedDocument.title}</h2>
                  <p className="mt-1 text-sm muted-text">
                    El diagrama vigente sigue activo hasta que el nuevo archivo termine de procesarse.
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-line bg-white/72 px-4 py-3 text-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                    Última actualización
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatDateTime(selectedDocument.updated_at, timezone)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <article className="rounded-[1.2rem] border border-line bg-white/72 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Producto</p>
                  <p className="mt-1 text-sm font-semibold">
                    {KNOWLEDGE_PRODUCT_LABELS[selectedDocument.product_type]}
                  </p>
                </article>
                <article className="rounded-[1.2rem] border border-line bg-white/72 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Archivo</p>
                  <p className="mt-1 text-sm font-semibold">{selectedDocument.file_name}</p>
                </article>
                <article className="rounded-[1.2rem] border border-line bg-white/72 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Peso</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatFileSize(selectedDocument.file_size_bytes)}
                  </p>
                </article>
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleUpdate}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="document_update_title">
                      Título visible
                    </label>
                    <input
                      className="field"
                      id="document_update_title"
                      onChange={(event) => setUpdateTitle(event.target.value)}
                      value={updateTitle}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="document_update_product">
                      Producto
                    </label>
                    <select
                      className="field"
                      id="document_update_product"
                      onChange={(event) =>
                        setUpdateProductType(event.target.value as KnowledgeProductType)
                      }
                      value={updateProductType}
                    >
                      {KNOWLEDGE_PRODUCT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="document_update_file">
                    Nuevo archivo
                  </label>
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.xlsx,.xlsm"
                    className="field file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:font-semibold"
                    id="document_update_file"
                    onChange={(event) => setUpdateFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <p className="mt-1 text-xs muted-text">
                    Reemplaza el contenido del documento actual y deja registro de la actualización.
                  </p>
                </div>

                {updateError ? (
                  <div className="rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {updateError}
                  </div>
                ) : null}

                <button
                  className="btn-primary px-5 py-3 text-sm font-semibold"
                  disabled={updatingDocumentId === selectedDocument.id}
                  type="submit"
                >
                  {updatingDocumentId === selectedDocument.id
                    ? "Actualizando..."
                    : "Actualizar diagrama"}
                </button>
              </form>
            </>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-line-strong bg-white/60 px-4 py-10 text-center">
              <p className="text-base font-semibold">Selecciona un diagrama para mantenerlo.</p>
              <p className="mt-1 text-sm muted-text">
                Desde aquí reemplazas el archivo vigente sin perder control de la fecha de cambio.
              </p>
            </div>
          )}
        </section>

        <section className="panel rounded-[1.6rem] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-strong">
                Auditoría
              </p>
              <h2 className="mt-1.5 text-xl font-semibold">Bitácora del documento</h2>
              <p className="mt-1 text-sm muted-text">
                Registro simple de alta y actualización del archivo vigente.
              </p>
            </div>
            {selectedDocument ? (
              <p className="text-sm font-semibold text-foreground">
                {selectedDocumentAudits.length} evento
                {selectedDocumentAudits.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {selectedDocument ? (
              selectedDocumentAudits.length ? (
                selectedDocumentAudits.map((audit) => (
                  <article
                    className="rounded-[1.2rem] border border-line bg-white/78 px-4 py-3"
                    key={audit.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold">
                            {KNOWLEDGE_AUDIT_ACTION_LABELS[audit.action]}
                          </span>
                          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            {KNOWLEDGE_PRODUCT_LABELS[audit.product_type]}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold">{audit.title}</p>
                        <p className="mt-1 text-sm muted-text">
                          {audit.file_name} · {formatFileSize(audit.file_size_bytes)}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                          Fecha
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatDateTime(audit.created_at, timezone)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-line-strong bg-white/60 px-4 py-10 text-center">
                  <p className="text-base font-semibold">Sin eventos todavía.</p>
                  <p className="mt-1 text-sm muted-text">
                    La bitácora aparecerá cuando se cree o actualice este documento.
                  </p>
                </div>
              )
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-line-strong bg-white/60 px-4 py-10 text-center">
                <p className="text-base font-semibold">No hay documento seleccionado.</p>
                <p className="mt-1 text-sm muted-text">
                  Elige uno de la lista para revisar su historial.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
