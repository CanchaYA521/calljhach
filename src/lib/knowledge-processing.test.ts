import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import {
  extractDrawingTarget,
  extractPlanOfferSections,
  extractSpreadsheetText,
  extractTextNodesFromDrawingXml,
} from "./knowledge-processing";

describe("knowledge spreadsheet processing", () => {
  it("extracts sheet and row text from xlsm/xlsx buffers", () => {
    const workbook = utils.book_new();
    const worksheet = utils.aoa_to_sheet([
      ["Proceso", "Contrato", "Validacion"],
      ["Portabilidad", "DNI + voz", "Biometria"],
    ]);

    utils.book_append_sheet(workbook, worksheet, "Porta");

    const buffer = Buffer.from(
      write(workbook, {
        type: "buffer",
        bookType: "xlsm",
      }) as Buffer,
    );

    const result = extractSpreadsheetText(buffer);

    expect(result.extractedText).toContain("[Hoja Porta]");
    expect(result.extractedText).toContain("Fila 1: Proceso | Contrato | Validacion");
    expect(result.extractedText).toContain("Fila 2: Portabilidad | DNI + voz | Biometria");
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("parses drawing relationships and text nodes from spreadsheet xml", () => {
    const relXml =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';
    const drawingXml =
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:sp><xdr:txBody><a:p><a:r><a:t>Contrato solo chip</a:t></a:r></a:p><a:p><a:r><a:t>Validacion biometrica</a:t></a:r></a:p></xdr:txBody></xdr:sp></xdr:twoCellAnchor></xdr:wsDr>';

    expect(extractDrawingTarget(relXml)).toBe("xl/drawings/drawing1.xml");
    expect(extractTextNodesFromDrawingXml(drawingXml)).toEqual([
      "Contrato solo chip",
      "Validacion biometrica",
    ]);
  });

  it("builds structured plan offer sections from positioned pdf text", () => {
    const items = [
      { text: "APPLE IPHONE 13", x: 245, y: 372 },
      { text: "128 GB", x: 418, y: 372 },
      { text: "85 GB", x: 680, y: 372 },
      { text: "Max", x: 834, y: 368 },
      { text: "S/ 149", x: 60, y: 351 },
      { text: "x 12 meses", x: 666, y: 348 },
      { text: "VIP 50", x: 825, y: 339 },
      { text: "XIAOMI 15T", x: 245, y: 330 },
      { text: "512 GB", x: 374, y: 330 },
      { text: "Luego 40 GB", x: 673, y: 331 },
      { text: "XIAOMI 15T PRO", x: 245, y: 457 },
      { text: "512 GB", x: 409, y: 457 },
      { text: "115 GB +", x: 668, y: 453 },
      { text: "Max VIP", x: 816, y: 453 },
      { text: "S/ 199", x: 60, y: 439 },
      { text: "ILIMITADO", x: 655, y: 424 },
      { text: "Ilimitado 70", x: 796, y: 424 },
      { text: "APPLE IPHONE 14", x: 245, y: 417 },
      { text: "128 GB", x: 433, y: 417 },
    ];

    const sections = extractPlanOfferSections(items, 1);
    const vip50Section = sections.find((section) => section.text.includes("Plan: Max VIP 50"));

    expect(vip50Section?.text).toContain("Precio: S/ 149");
    expect(vip50Section?.text).toContain("Equipos: APPLE IPHONE 13 128 GB; XIAOMI 15T 512 GB");
  });
});
