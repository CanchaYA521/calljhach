import "server-only";

import { read, type WorkBook, utils } from "xlsx";

import { describeImageDiagram } from "@/lib/groq";
import {
  buildDocumentSummary,
  splitTextIntoChunks,
} from "@/lib/knowledge";

type DocumentChunkDraft = {
  chunk_index: number;
  page_number: number | null;
  content: string;
};

type ProcessKnowledgeDocumentInput = {
  buffer: Buffer;
  title: string;
  mimeType: string;
  productLabel: string;
  imageUrl?: string | null;
};

type ProcessKnowledgeDocumentResult = {
  extractedText: string;
  summary: string;
  pageCount: number | null;
  chunks: DocumentChunkDraft[];
};

type PdfPositionedTextItem = {
  text: string;
  x: number;
  y: number;
};

type PdfStructuredSection = {
  pageNumber: number;
  text: string;
};

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
]);

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const DEVICE_PATTERN =
  /\b(iphone|samsung|galaxy|xiaomi|honor|motorola|oppo|redmi|poco|vivo|zte|huawei)\b/i;

type WorkbookWithFiles = WorkBook & {
  files?: Record<
    string,
    {
      content?: unknown;
    }
  >;
};

function decodeXmlEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\r");
}

function normalizeSpreadsheetTarget(target: string) {
  const cleanedTarget = target.trim().replace(/^\/+/, "");

  if (cleanedTarget.startsWith("xl/")) {
    return cleanedTarget;
  }

  if (cleanedTarget.startsWith("../")) {
    return `xl/${cleanedTarget.replace(/^\.\.\//, "")}`;
  }

  return `xl/${cleanedTarget}`;
}

function getFileContent(workbook: WorkbookWithFiles, path: string) {
  const entry = workbook.files?.[path];

  if (!entry?.content) {
    return null;
  }

  return String(entry.content);
}

function normalizeInlineText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const normalized = normalizeInlineText(line);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

export function extractDrawingTarget(sheetRelationshipXml: string) {
  const drawingRelationshipMatch = sheetRelationshipXml.match(
    /<Relationship[^>]+Type="[^"]*\/drawing"[^>]+Target="([^"]+)"/i,
  );

  if (!drawingRelationshipMatch?.[1]) {
    return null;
  }

  return normalizeSpreadsheetTarget(drawingRelationshipMatch[1]);
}

export function extractTextNodesFromDrawingXml(drawingXml: string) {
  return Array.from(drawingXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
    .map((match) => decodeXmlEntities(match[1] ?? "").trim())
    .filter(Boolean);
}

function extractSpreadsheetDrawingSections(workbook: WorkbookWithFiles) {
  return workbook.SheetNames.map((sheetName, index) => {
    const relationshipPath = `xl/worksheets/_rels/sheet${index + 1}.xml.rels`;
    const relationshipXml = getFileContent(workbook, relationshipPath);

    if (!relationshipXml) {
      return null;
    }

    const drawingPath = extractDrawingTarget(relationshipXml);

    if (!drawingPath) {
      return null;
    }

    const drawingXml = getFileContent(workbook, drawingPath);

    if (!drawingXml) {
      return null;
    }

    const texts = extractTextNodesFromDrawingXml(drawingXml);

    if (!texts.length) {
      return null;
    }

    return {
      pageNumber: null,
      text: `[Hoja ${sheetName} · Diagrama]\n${texts.join("\n")}`,
    };
  }).filter((sheet): sheet is { pageNumber: null; text: string } => sheet !== null);
}

function buildChunksFromPages(
  pages: Array<{
    pageNumber: number | null;
    text: string;
  }>,
) {
  let chunkIndex = 0;

  return pages.flatMap((page) =>
    splitTextIntoChunks(page.text).map((content) => ({
      chunk_index: chunkIndex++,
      page_number: page.pageNumber,
      content,
    })),
  );
}

function groupPdfItemsByRow(items: PdfPositionedTextItem[], threshold = 6) {
  const rows: Array<{
    y: number;
    items: PdfPositionedTextItem[];
  }> = [];

  for (const item of [...items].sort((left, right) => right.y - left.y || left.x - right.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= threshold);

    if (row) {
      row.items.push(item);
      continue;
    }

    rows.push({
      y: item.y,
      items: [item],
    });
  }

  return rows
    .map((row) => ({
      y: row.y,
      items: row.items.sort((left, right) => left.x - right.x),
      text: normalizeInlineText(row.items.map((item) => item.text).join(" ")),
    }))
    .sort((left, right) => right.y - left.y);
}

export function extractPlanOfferSections(items: PdfPositionedTextItem[], pageNumber: number) {
  const rows = groupPdfItemsByRow(items).filter((row) => row.text);
  const priceRows = rows.filter((row) => /S\/\s*\d{2,3}/i.test(row.text));

  if (priceRows.length < 2) {
    return [];
  }

  return priceRows
    .map((priceRow, index) => {
      const upperBoundary =
        index === 0 ? Number.POSITIVE_INFINITY : (priceRows[index - 1].y + priceRow.y) / 2;
      const lowerBoundary =
        index === priceRows.length - 1
          ? Number.NEGATIVE_INFINITY
          : (priceRow.y + priceRows[index + 1].y) / 2;
      const regionRows = rows.filter((row) => row.y <= upperBoundary && row.y > lowerBoundary);

      const equipmentLines = dedupeLines(
        regionRows
          .map((row) =>
            normalizeInlineText(
              row.items
                .filter((item) => item.x >= 220 && item.x < 620)
                .map((item) => item.text)
                .join(" "),
            ),
          )
          .filter((line) => DEVICE_PATTERN.test(line)),
      );

      if (!equipmentLines.length) {
        return null;
      }

      const planText = normalizeInlineText(
        dedupeLines(
          regionRows
            .map((row) =>
              normalizeInlineText(
                row.items
                  .filter((item) => item.x >= 780)
                  .map((item) => item.text)
                  .join(" "),
              ),
            )
            .filter(Boolean),
        ).join(" "),
      );

      if (!planText) {
        return null;
      }

      const benefitText = normalizeInlineText(
        dedupeLines(
          regionRows
            .map((row) =>
              normalizeInlineText(
                row.items
                  .filter((item) => item.x >= 620 && item.x < 780)
                  .map((item) => item.text)
                  .join(" "),
              ),
            )
            .filter(Boolean),
        ).join(" "),
      );

      return {
        pageNumber,
        text:
          `[Oferta pagina ${pageNumber}]\n` +
          `Precio: ${normalizeInlineText(priceRow.text)}\n` +
          `Plan: ${planText}\n` +
          `${benefitText ? `Beneficios: ${benefitText}\n` : ""}` +
          `Equipos: ${equipmentLines.join("; ")}`,
      };
    })
    .filter((section): section is PdfStructuredSection => section !== null);
}

async function extractStructuredPdfSections(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  try {
    const sections: PdfStructuredSection[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent({
        disableNormalization: false,
      });
      const items = textContent.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) {
          return [];
        }

        return [
          {
            text: item.str.trim(),
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
          },
        ];
      });

      sections.push(...extractPlanOfferSections(items, pageNumber));
      page.cleanup();
    }

    return sections;
  } finally {
    await document.destroy();
  }
}

async function processPdfDocument(
  buffer: Buffer,
  fallbackTitle: string,
): Promise<ProcessKnowledgeDocumentResult> {
  // Load pdf-parse at runtime so Next keeps pdfjs on the Node side instead of bundling
  // its worker into the server chunk graph.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    const structuredSections = await extractStructuredPdfSections(buffer);
    const pages = [
      ...structuredSections.map((section) => ({
        pageNumber: section.pageNumber,
        text: section.text,
      })),
      ...result.pages
        .map((page) => ({
          pageNumber: page.num,
          text: page.text.trim(),
        }))
        .filter((page) => page.text),
    ];
    const extractedText = pages
      .map((page) => `[Pagina ${page.pageNumber}]\n${page.text}`)
      .join("\n\n");
    const summary = buildDocumentSummary(
      extractedText,
      `Documento ${fallbackTitle} cargado sin contenido de texto suficiente.`,
    );

    return {
      extractedText,
      summary,
      pageCount: result.total,
      chunks: buildChunksFromPages(pages),
    };
  } finally {
    await parser.destroy();
  }
}

function processTextDocument(buffer: Buffer, fallbackTitle: string) {
  const extractedText = buffer.toString("utf-8").trim();
  const summary = buildDocumentSummary(
    extractedText,
    `Documento ${fallbackTitle} cargado sin contenido legible.`,
  );

  return {
    extractedText,
    summary,
    pageCount: null,
    chunks: buildChunksFromPages([{ pageNumber: null, text: extractedText }]),
  };
}

async function processImageDocument(input: {
  imageUrl: string;
  title: string;
  productLabel: string;
}) {
  const extractedText = await describeImageDiagram(input);
  const summary = buildDocumentSummary(
    extractedText,
    `Diagrama ${input.title} procesado por vision.`,
  );

  return {
    extractedText,
    summary,
    pageCount: 1,
    chunks: buildChunksFromPages([{ pageNumber: 1, text: extractedText }]),
  };
}

export function extractSpreadsheetText(buffer: Buffer) {
  const workbook = read(buffer, {
    cellFormula: true,
    cellHTML: false,
    cellStyles: false,
    cellText: true,
    dense: false,
    raw: false,
    bookFiles: true,
  }) as WorkbookWithFiles;

  const cellSheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return null;
    }

    const rows = utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    const rowText = rows
      .map((row, rowIndex) => {
        const formattedCells = row
          .map((cell) => String(cell ?? "").trim())
          .filter(Boolean)
          .join(" | ");

        return formattedCells ? `Fila ${rowIndex + 1}: ${formattedCells}` : "";
      })
      .filter(Boolean)
      .join("\n");

    if (!rowText) {
      return null;
    }

    return {
      pageNumber: null,
      text: `[Hoja ${sheetName}]\n${rowText}`,
    };
  }).filter((sheet): sheet is { pageNumber: null; text: string } => sheet !== null);
  const drawingSheets = extractSpreadsheetDrawingSections(workbook);
  const sheets = [...cellSheets, ...drawingSheets];

  const extractedText = sheets.map((sheet) => sheet.text).join("\n\n");
  const summary = buildDocumentSummary(
    extractedText,
    "Libro de Excel cargado sin contenido legible en celdas.",
  );

  return {
    extractedText,
    summary,
    pageCount: sheets.length,
    chunks: buildChunksFromPages(sheets),
  };
}

export async function processKnowledgeDocument(
  input: ProcessKnowledgeDocumentInput,
): Promise<ProcessKnowledgeDocumentResult> {
  const normalizedMimeType = input.mimeType.trim().toLowerCase();

  if (normalizedMimeType === "application/pdf") {
    return processPdfDocument(input.buffer, input.title);
  }

  if (TEXT_MIME_TYPES.has(normalizedMimeType)) {
    return processTextDocument(input.buffer, input.title);
  }

  if (SPREADSHEET_MIME_TYPES.has(normalizedMimeType)) {
    return extractSpreadsheetText(input.buffer);
  }

  if (normalizedMimeType.startsWith("image/")) {
    if (!input.imageUrl) {
      throw new Error("No se pudo obtener una URL firmada para analizar la imagen.");
    }

    return processImageDocument({
      imageUrl: input.imageUrl,
      title: input.title,
      productLabel: input.productLabel,
    });
  }

  throw new Error(
    "Formato no soportado. Usa PDF, PNG, JPG, WEBP, TXT o MD para los diagramas.",
  );
}
