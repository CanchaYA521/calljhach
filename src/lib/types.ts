export type ProductType =
  | "reno"
  | "porta"
  | "linea_nueva"
  | "fija"
  | "migracion"
  | "upgrade";

export type CaseStatus =
  | "nuevo"
  | "contactado"
  | "agendado"
  | "recuperado"
  | "perdido";
export type RecoveryCaseStatus = "agendado" | "perdido";

export type DateFilter = "all" | "today" | "upcoming" | "overdue" | "unscheduled";
export type RecoveryPreset = "all" | "open" | "today" | "recovered" | "overdue";
export type SaleType = "recojo" | "delivery";
export type SaleDateFilter = "all" | "today" | "upcoming" | "past";
export type SaleResult = "pendiente" | "venta" | "caida";
export type SalesPreset = "all" | "pending" | "sold" | "dropped" | "today";
export type KnowledgeProductType = ProductType | "general";
export type KnowledgeDocumentStatus = "processing" | "ready" | "error";
export type KnowledgeChatScope = "product" | "all";
export type KnowledgeDocumentAuditAction = "created" | "updated";

export type CaseRecord = {
  id: string;
  user_id: string;
  customer_name: string;
  phone: string;
  product_type: ProductType;
  status: CaseStatus;
  scheduled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SaleFollowUpRecord = {
  id: string;
  user_id: string;
  phone: string;
  sec: string;
  product_type: ProductType;
  sale_type: SaleType;
  sale_result: SaleResult;
  picked_up: boolean;
  for_when: string;
  sale_date: string;
  created_at: string;
  updated_at: string;
};

export type ProfileRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type DashboardSummary = {
  openCount: number;
  todayScheduled: number;
  recentRecovered: number;
  overdueCount: number;
};

export type SalesSummary = {
  pendingCount: number;
  soldCount: number;
  droppedCount: number;
  todayCount: number;
};

export type KnowledgeDocumentRecord = {
  id: string;
  user_id: string;
  title: string;
  product_type: KnowledgeProductType;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: KnowledgeDocumentStatus;
  summary: string | null;
  extracted_text: string | null;
  page_count: number | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeChunkRecord = {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
  created_at: string;
};

export type KnowledgeCitation = {
  document_id: string;
  title: string;
  product_type: KnowledgeProductType;
  page_number: number | null;
  chunk_index: number;
};

export type KnowledgeChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: KnowledgeCitation[];
};

export type KnowledgeDocumentAuditRecord = {
  id: string;
  document_id: string;
  user_id: string;
  action: KnowledgeDocumentAuditAction;
  title: string;
  product_type: KnowledgeProductType;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};
