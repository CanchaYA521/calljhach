import { describe, expect, it } from "vitest";

import {
  buildRecoveryWhatsAppMessage,
  buildSaleWhatsAppMessage,
  buildWhatsAppUrl,
  getPeruGreeting,
} from "./whatsapp";
import type { CaseRecord, SaleFollowUpRecord } from "./types";

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "case-1",
    user_id: "user-1",
    customer_name: "+51999111222",
    phone: "+51999111222",
    product_type: "reno",
    status: "agendado",
    scheduled_at: "2026-03-12T15:00:00.000Z",
    notes: null,
    created_at: "2026-03-10T16:00:00.000Z",
    updated_at: "2026-03-11T17:00:00.000Z",
    ...overrides,
  };
}

function makeSale(overrides: Partial<SaleFollowUpRecord> = {}): SaleFollowUpRecord {
  return {
    id: "sale-1",
    user_id: "user-1",
    phone: "+51999111222",
    sec: "SEC-1001",
    product_type: "reno",
    sale_type: "recojo",
    sale_result: "venta",
    picked_up: false,
    for_when: "a las 7 pm",
    sale_date: "2026-03-11",
    created_at: "2026-03-10T16:00:00.000Z",
    updated_at: "2026-03-11T17:00:00.000Z",
    ...overrides,
  };
}

describe("whatsapp helpers", () => {
  it("returns the greeting based on Peru time", () => {
    expect(getPeruGreeting(new Date("2026-03-11T13:00:00.000Z"))).toBe("Buenos días");
    expect(getPeruGreeting(new Date("2026-03-11T19:00:00.000Z"))).toBe("Buenas tardes");
    expect(getPeruGreeting(new Date("2026-03-12T01:00:00.000Z"))).toBe("Buenas noches");
  });

  it("builds a recovery message for scheduled calls", () => {
    const message = buildRecoveryWhatsAppMessage(
      makeCase(),
      "America/Lima",
      new Date("2026-03-11T14:00:00.000Z"),
    );

    expect(message).toContain("Buenos días");
    expect(message).toContain("Renovación de equipo");
    expect(message).toContain("Le escribo para confirmar la llamada agendada");
    expect(message).toContain("12 de marzo");
    expect(message).not.toContain("2026");
    expect(message).toContain("Si tiene alguna consulta o ayuda, pregunte nomás.");
  });

  it("builds a sales message with recojo reminder and dni", () => {
    const message = buildSaleWhatsAppMessage(
      makeSale(),
      "America/Lima",
      new Date("2026-03-11T20:00:00.000Z"),
    );

    expect(message).toContain("Buenas tardes");
    expect(message).toContain("quedó coordinado el recojo");
    expect(message).toContain("11 de marzo");
    expect(message).not.toContain("2026");
    expect(message).toContain("Su código de recojo es SEC-1001");
    expect(message).toContain("DNI");
    expect(message).toContain("Si tiene alguna consulta o ayuda, pregunte nomás.");
  });

  it("creates a wa.me url with normalized phone", () => {
    expect(buildWhatsAppUrl("+51 999-111-222", "Hola")).toContain(
      "https://wa.me/51999111222?text=Hola",
    );
  });
});
