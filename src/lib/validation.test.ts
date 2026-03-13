import { describe, expect, it } from "vitest";

import {
  caseFormSchema,
  getCaseFormDefaults,
  saleFollowUpSchema,
  toCasePayload,
  toSaleFollowUpPayload,
} from "./validation";

describe("case form schema", () => {
  it("requires a schedule when status is agendado", () => {
    const result = caseFormSchema.safeParse({
      phone: "+51999111222",
      product_type: "reno",
      status: "agendado",
      scheduled_at: "",
      notes: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.scheduled_at?.[0]).toContain(
        "obligatorias",
      );
    }
  });

  it("normalizes phone and datetime when building the payload", () => {
    expect(
      toCasePayload({
        customer_name: "",
        phone: "+51 999-111-222",
        product_type: "upgrade",
        status: "perdido",
        scheduled_at: "2026-03-10T15:30",
        notes: "  Cliente pidió volver a llamar  ",
      }),
    ).toEqual({
      customer_name: "+51999111222",
      phone: "+51999111222",
      product_type: "upgrade",
      status: "perdido",
      scheduled_at: "2026-03-10T20:30:00.000Z",
      notes: "Cliente pidió volver a llamar",
    });
  });

  it("defaults a new case to agendado", () => {
    expect(getCaseFormDefaults(null).status).toBe("agendado");
  });

  it("normalizes legacy statuses to agendado in the form", () => {
    expect(
      getCaseFormDefaults({
        id: "case-1",
        user_id: "user-1",
        customer_name: "+51999111222",
        phone: "+51999111222",
        product_type: "reno",
        status: "contactado",
        scheduled_at: null,
        notes: null,
        created_at: "2026-03-10T10:00:00.000Z",
        updated_at: "2026-03-10T10:00:00.000Z",
      }).status,
    ).toBe("agendado");
  });

  it("rejects recovery statuses outside agendado and perdido", () => {
    const result = caseFormSchema.safeParse({
      phone: "+51999111222",
      product_type: "reno",
      status: "contactado",
      scheduled_at: "",
      notes: "",
    });

    expect(result.success).toBe(false);
  });

  it("validates and normalizes sale follow up payload", () => {
    expect(
      toSaleFollowUpPayload({
        phone: "+51 999-111-222",
        sec: "  SEC-1290  ",
        product_type: "porta",
        sale_type: "delivery",
        sale_result: "pendiente",
        picked_up: false,
        for_when: "  mañana por la mañana ",
        sale_date: "2026-03-15",
      }),
    ).toEqual({
      phone: "+51999111222",
      sec: "SEC-1290",
      product_type: "porta",
      sale_type: "delivery",
      sale_result: "pendiente",
      picked_up: false,
      for_when: "mañana por la mañana",
      sale_date: "2026-03-15",
    });
  });

  it("forces a picked up follow up to be a sale", () => {
    expect(
      toSaleFollowUpPayload({
        phone: "+51999111222",
        sec: "SEC-1002",
        product_type: "reno",
        sale_type: "recojo",
        sale_result: "pendiente",
        picked_up: true,
        for_when: "hoy",
        sale_date: "2026-03-15",
      }),
    ).toEqual({
      phone: "+51999111222",
      sec: "SEC-1002",
      product_type: "reno",
      sale_type: "recojo",
      sale_result: "venta",
      picked_up: true,
      for_when: "hoy",
      sale_date: "2026-03-15",
    });
  });

  it("requires sec and sale date in sale follow up schema", () => {
    const result = saleFollowUpSchema.safeParse({
      phone: "+51999111222",
      sec: "",
      product_type: "reno",
      sale_type: "recojo",
      sale_result: "pendiente",
      picked_up: false,
      for_when: "mañana",
      sale_date: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.sec?.[0]).toContain("SEC");
      expect(result.error.flatten().fieldErrors.sale_date?.[0]).toContain("fecha");
    }
  });

  it("rejects picked_up for delivery follow ups", () => {
    const result = saleFollowUpSchema.safeParse({
      phone: "+51999111222",
      sec: "SEC-555",
      product_type: "reno",
      sale_type: "delivery",
      sale_result: "venta",
      picked_up: true,
      for_when: "mañana",
      sale_date: "2026-03-15",
    });

    expect(result.success).toBe(false);
  });
});
