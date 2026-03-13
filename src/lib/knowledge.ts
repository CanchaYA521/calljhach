import { KNOWLEDGE_PRODUCT_LABELS } from "@/lib/constants";
import type {
  KnowledgeChatScope,
  KnowledgeChunkRecord,
  KnowledgeCitation,
  KnowledgeDocumentRecord,
  KnowledgeProductType,
  ProductType,
} from "@/lib/types";

const SPANISH_STOP_WORDS = new Set([
  "a",
  "al",
  "algo",
  "ante",
  "con",
  "contra",
  "como",
  "cual",
  "cuando",
  "de",
  "del",
  "desde",
  "donde",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "era",
  "eran",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "fue",
  "ha",
  "hasta",
  "hay",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "más",
  "mi",
  "mis",
  "muy",
  "no",
  "nos",
  "o",
  "para",
  "pero",
  "por",
  "que",
  "qué",
  "se",
  "si",
  "sin",
  "sobre",
  "su",
  "sus",
  "te",
  "tu",
  "tus",
  "un",
  "una",
  "uno",
  "y",
  "ya",
]);

const OFFER_QUERY_STOP_WORDS = new Set([
  "barato",
  "baratos",
  "caro",
  "caros",
  "equipo",
  "equipos",
  "ofrecer",
  "ofrece",
  "ofrecen",
  "ofrezco",
  "dan",
  "dame",
  "cual",
  "cuales",
  "plan",
  "planes",
  "sacar",
  "precio",
  "precios",
  "quiero",
  "puedo",
]);

type RankableChunk = KnowledgeChunkRecord & {
  document: Pick<KnowledgeDocumentRecord, "id" | "title" | "product_type">;
};

type KnowledgeOffer = {
  priceLabel: string;
  priceValue: number;
  plan: string;
  benefits: string | null;
  equipments: string[];
  source: RankableChunk;
};

type StructuredOfferAnswer = {
  answer: string;
  citations: KnowledgeCitation[];
};

export function sanitizeKnowledgeText(text: string) {
  return text.replace(/\u0000/g, "").replace(/\r/g, "").replace(/\t/g, " ").trim();
}

export function splitTextIntoChunks(
  source: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
  },
) {
  const chunkSize = options?.chunkSize ?? 900;
  const overlap = options?.overlap ?? 160;
  const text = sanitizeKnowledgeText(source).replace(/\n{3,}/g, "\n\n");

  if (!text) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const hardLimit = Math.min(cursor + chunkSize, text.length);
    let splitPoint = hardLimit;

    if (hardLimit < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", hardLimit);
      const lineBreak = text.lastIndexOf("\n", hardLimit);
      const sentenceBreak = Math.max(
        text.lastIndexOf(". ", hardLimit),
        text.lastIndexOf(": ", hardLimit),
      );
      const candidate = [paragraphBreak, lineBreak, sentenceBreak].find(
        (value) => value > cursor + Math.floor(chunkSize * 0.55),
      );

      if (candidate) {
        splitPoint = candidate;
      }
    }

    const chunk = text.slice(cursor, splitPoint).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (splitPoint >= text.length) {
      break;
    }

    cursor = Math.max(splitPoint - overlap, cursor + 1);
  }

  return chunks;
}

function normalizeForSearch(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokenize(text: string) {
  return normalizeForSearch(text)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 1 && !SPANISH_STOP_WORDS.has(token));
}

function cleanOfferField(text: string) {
  return sanitizeKnowledgeText(text)
    .replace(/\bM A T E R I A L\b[\s\S]*$/i, "")
    .replace(/\bTrade\b[\s\S]*$/i, "")
    .replace(/\bMarketing\b[\s\S]*$/i, "")
    .replace(/^PLAN\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatEquipmentList(equipments: string[]) {
  if (equipments.length <= 1) {
    return equipments[0] ?? "";
  }

  if (equipments.length === 2) {
    return `${equipments[0]} y ${equipments[1]}`;
  }

  return `${equipments.slice(0, -1).join(", ")} y ${equipments.at(-1)}`;
}

function buildCitationFromChunk(chunk: RankableChunk): KnowledgeCitation {
  return {
    document_id: chunk.document.id,
    title: chunk.document.title,
    product_type: chunk.document.product_type,
    page_number: chunk.page_number,
    chunk_index: chunk.chunk_index,
  };
}

function parseOfferChunk(chunk: RankableChunk): KnowledgeOffer | null {
  if (!chunk.content.startsWith("[Oferta pagina")) {
    return null;
  }

  const priceMatch = chunk.content.match(/Precio:\s*(.+)/i);
  const planMatch = chunk.content.match(/Plan:\s*(.+)/i);
  const benefitsMatch = chunk.content.match(/Beneficios:\s*(.+)/i);
  const equipmentMatch = chunk.content.match(/Equipos:\s*(.+)/i);

  if (!priceMatch?.[1] || !planMatch?.[1] || !equipmentMatch?.[1]) {
    return null;
  }

  const priceLabel = cleanOfferField(priceMatch[1]);
  const priceValue = Number(priceLabel.match(/\d{2,3}/)?.[0]);
  const plan = cleanOfferField(planMatch[1]);
  const benefits = benefitsMatch?.[1] ? cleanOfferField(benefitsMatch[1]) : null;
  const equipments = equipmentMatch[1]
    .split(/\s*;\s*/g)
    .map((equipment) => cleanOfferField(equipment))
    .filter(Boolean);

  if (!priceValue || !plan || !equipments.length) {
    return null;
  }

  return {
    priceLabel,
    priceValue,
    plan,
    benefits,
    equipments,
    source: chunk,
  };
}

export function extractKnowledgeOffers(chunks: RankableChunk[]) {
  return chunks
    .map(parseOfferChunk)
    .filter((offer): offer is KnowledgeOffer => offer !== null)
    .sort((left, right) => left.priceValue - right.priceValue);
}

function matchOfferToQuestion(offers: KnowledgeOffer[], question: string) {
  const normalizedQuestion = normalizeForSearch(question);
  const usefulTokens = tokenize(question).filter((token) => !OFFER_QUERY_STOP_WORDS.has(token));
  const numericTokens = usefulTokens.filter((token) => /\d/.test(token));

  const ranked = offers
    .map((offer) => {
      const haystack = normalizeForSearch(
        `${offer.plan} ${offer.benefits ?? ""} ${offer.priceLabel} ${offer.equipments.join(" ")}`,
      );
      const tokenScore = usefulTokens.reduce(
        (score, token) => score + (haystack.includes(token) ? 2 : 0),
        0,
      );
      const numericScore = numericTokens.reduce(
        (score, token) => score + (haystack.includes(token) ? 3 : 0),
        0,
      );
      const phraseScore =
        normalizedQuestion.includes(normalizeForSearch(offer.plan)) ||
        normalizeForSearch(offer.plan).includes(normalizedQuestion)
          ? 5
          : 0;

      return {
        offer,
        score: tokenScore + numericScore + phraseScore,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.offer.priceValue - right.offer.priceValue);

  if (!ranked.length) {
    return null;
  }

  if (numericTokens.length > 0) {
    const numericMatch = ranked.find((entry) =>
      numericTokens.every((token) =>
        normalizeForSearch(
          `${entry.offer.plan} ${entry.offer.benefits ?? ""} ${entry.offer.priceLabel}`,
        ).includes(token),
      ),
    );

    if (numericMatch) {
      return numericMatch.offer;
    }
  }

  return ranked[0]?.offer ?? null;
}

export function answerStructuredOfferQuestion(
  chunks: RankableChunk[],
  question: string,
): StructuredOfferAnswer | null {
  const offers = extractKnowledgeOffers(chunks);

  if (!offers.length) {
    return null;
  }

  const asksCheapest = /(mas barato|más barato|menor precio|precio mas bajo|precio más bajo)/i.test(
    question,
  );
  const asksMostExpensive = /(mas caro|más caro|mayor precio|precio mas alto|precio más alto)/i.test(
    question,
  );
  const asksEquipment = /\bequipo\b|\bequipos\b/i.test(question);
  const asksPlanVip =
    /\bvip\b/i.test(question) ||
    /\bmax\b/i.test(question) ||
    /\bilimitado\b/i.test(question) ||
    /\b50\b|\b70\b|\b99\b|\b160\b|\b190\b/.test(question);

  if (asksCheapest && asksMostExpensive) {
    const cheapest = offers[0];
    const mostExpensive = offers.at(-1);

    if (!cheapest || !mostExpensive) {
      return null;
    }

    return {
      answer:
        `Más barato: ${cheapest.priceLabel} - ${cheapest.plan} - Equipos: ${formatEquipmentList(
          cheapest.equipments,
        )}.\n` +
        `Más caro: ${mostExpensive.priceLabel} - ${mostExpensive.plan} - Equipos: ${formatEquipmentList(
          mostExpensive.equipments,
        )}.`,
      citations: [
        buildCitationFromChunk(cheapest.source),
        buildCitationFromChunk(mostExpensive.source),
      ],
    };
  }

  if (asksCheapest) {
    const offer = offers[0];

    return {
      answer: `Plan más barato: ${offer.priceLabel} - ${offer.plan} - Equipos: ${formatEquipmentList(
        offer.equipments,
      )}.`,
      citations: [buildCitationFromChunk(offer.source)],
    };
  }

  if (asksMostExpensive) {
    const offer = offers.at(-1);

    if (!offer) {
      return null;
    }

    return {
      answer: `Plan más caro: ${offer.priceLabel} - ${offer.plan} - Equipos: ${formatEquipmentList(
        offer.equipments,
      )}.`,
      citations: [buildCitationFromChunk(offer.source)],
    };
  }

  if (asksEquipment && asksPlanVip) {
    const offer = matchOfferToQuestion(offers, question);

    if (!offer) {
      return null;
    }

    return {
      answer: `${offer.plan} ${offer.priceLabel}: ${formatEquipmentList(offer.equipments)}.`,
      citations: [buildCitationFromChunk(offer.source)],
    };
  }

  return null;
}

export function buildDocumentSummary(text: string, fallback: string) {
  const compact = sanitizeKnowledgeText(text).replace(/\s+/g, " ");

  if (!compact) {
    return fallback;
  }

  return compact.length > 220 ? `${compact.slice(0, 220).trim()}...` : compact;
}

export function getKnowledgeProductLabel(productType: KnowledgeProductType) {
  return KNOWLEDGE_PRODUCT_LABELS[productType];
}

export function sanitizeStorageFileName(fileName: string) {
  const [rawName, rawExtension] = fileName.split(/\.(?=[^.]+$)/);
  const safeName = rawName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const extension = rawExtension
    ? rawExtension.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase()
    : "";

  return extension ? `${safeName || "archivo"}.${extension}` : safeName || "archivo";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function selectKnowledgeDocumentsForChat(
  documents: KnowledgeDocumentRecord[],
  options: {
    documentId?: string | null;
    productType?: ProductType | null;
    scope?: KnowledgeChatScope | null;
  },
) {
  if (options.documentId) {
    return documents.filter((document) => document.id === options.documentId);
  }

  if (options.scope === "all") {
    return documents;
  }

  if (!options.productType) {
    return documents;
  }

  const scopedDocuments = documents.filter(
    (document) =>
      document.product_type === "general" ||
      document.product_type === options.productType,
  );

  return scopedDocuments.length ? scopedDocuments : documents;
}

export function rankKnowledgeChunks(chunks: RankableChunk[], query: string) {
  const normalizedQuery = normalizeForSearch(query);
  const tokens = tokenize(query);

  return [...chunks]
    .map((chunk) => {
      const haystack = normalizeForSearch(
        `${chunk.document.title} ${chunk.document.product_type} ${chunk.content}`,
      );
      const tokenHits = tokens.reduce((score, token) => {
        return score + (haystack.includes(token) ? 1 : 0);
      }, 0);
      const phraseBonus = normalizedQuery && haystack.includes(normalizedQuery) ? 4 : 0;
      const titleBonus = normalizeForSearch(chunk.document.title).includes(normalizedQuery)
        ? 2
        : 0;
      const contentBonus = chunk.content.length < 500 ? 0.6 : 0;

      return {
        chunk,
        score: tokenHits * 2 + phraseBonus + titleBonus + contentBonus,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.chunk_index - right.chunk.chunk_index)
    .map((entry) => entry.chunk);
}

export function buildKnowledgeContext(chunks: RankableChunk[], limit = 6) {
  const selectedChunks = chunks.slice(0, limit);
  const citations: KnowledgeCitation[] = [];

  const context = selectedChunks
    .map((chunk) => {
      citations.push({
        document_id: chunk.document.id,
        title: chunk.document.title,
        product_type: chunk.document.product_type,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
      });

      const pageLabel = chunk.page_number ? ` | pagina ${chunk.page_number}` : "";

      return `[Documento: ${chunk.document.title} | producto: ${getKnowledgeProductLabel(chunk.document.product_type)}${pageLabel}]\n${chunk.content}`;
    })
    .join("\n\n");

  return {
    context,
    citations,
  };
}
