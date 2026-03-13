import { describe, expect, it } from "vitest";

import {
  computeSalesSummary,
  matchesSaleDateFilter,
  matchesSalesPreset,
  matchesSaleSearch,
  sortSaleFollowUps,
} from "./sales";
import type { SaleFollowUpRecord } from "./types";

function makeSale(overrides: Partial<SaleFollowUpRecord>): SaleFollowUpRecord {
  return {
    id: "sale-1",
    user_id: "user-1",
    phone: "+51999111222",
    sec: "SEC-1001",
    product_type: "reno",
    sale_type: "recojo",
    sale_result: "pendiente",
    picked_up: false,
    for_when: "mañana temprano",
    sale_date: "2026-03-10",
    created_at: "2026-03-09T12:00:00.000Z",
    updated_at: "2026-03-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("sales helpers", () => {
  it("filters by query against phone, sec and target text", () => {
    expect(matchesSaleSearch(makeSale({ sec: "SEC-7788" }), "7788")).toBe(true);
    expect(matchesSaleSearch(makeSale({ for_when: "sábado" }), "sábado")).toBe(true);
  });

  it("computes summary cards for sales tracking", () => {
    const sales = [
      makeSale({
        id: "pending",
        sale_type: "recojo",
        sale_result: "pendiente",
        sale_date: "2026-03-10",
      }),
      makeSale({
        id: "sold-picked",
        sale_type: "recojo",
        sale_result: "venta",
        picked_up: true,
        sale_date: "2026-03-10",
      }),
      makeSale({
        id: "dropped",
        sale_type: "delivery",
        sale_result: "caida",
        sale_date: "2026-03-12",
      }),
    ];

    expect(
      computeSalesSummary(
        sales,
        "America/Lima",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).toEqual({
      pendingCount: 1,
      soldCount: 1,
      droppedCount: 1,
      todayCount: 2,
    });
  });

  it("filters past and upcoming sale dates", () => {
    expect(
      matchesSaleDateFilter(
        makeSale({ sale_date: "2026-03-12" }),
        "upcoming",
        "America/Lima",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      matchesSaleDateFilter(
        makeSale({ sale_date: "2026-03-08" }),
        "past",
        "America/Lima",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("sorts sales by date and then most recent update", () => {
    const ordered = sortSaleFollowUps([
      makeSale({ id: "later", sale_date: "2026-03-12" }),
      makeSale({ id: "same-day-newer", updated_at: "2026-03-11T10:00:00.000Z" }),
      makeSale({ id: "same-day-older", updated_at: "2026-03-10T10:00:00.000Z" }),
    ]);

    expect(ordered.map((saleItem) => saleItem.id)).toEqual([
      "same-day-newer",
      "same-day-older",
      "later",
    ]);
  });

  it("matches summary presets for sales", () => {
    const now = new Date("2026-03-10T15:00:00.000Z");

    expect(
      matchesSalesPreset(
        makeSale({ sale_result: "pendiente" }),
        "pending",
        "America/Lima",
        now,
      ),
    ).toBe(true);
    expect(
      matchesSalesPreset(
        makeSale({ sale_result: "venta" }),
        "sold",
        "America/Lima",
        now,
      ),
    ).toBe(true);
    expect(
      matchesSalesPreset(
        makeSale({ sale_date: "2026-03-10" }),
        "today",
        "America/Lima",
        now,
      ),
    ).toBe(true);
  });
});
