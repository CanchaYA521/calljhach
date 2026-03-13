import { describe, expect, it } from "vitest";

import {
  computeDashboardSummary,
  matchesRecoveryPreset,
  matchesDateFilter,
  normalizePhone,
  sortCases,
} from "./cases";
import type { CaseRecord } from "./types";

function makeCase(overrides: Partial<CaseRecord>): CaseRecord {
  return {
    id: "case-1",
    user_id: "user-1",
    customer_name: "Ana Perez",
    phone: "+51999111222",
    product_type: "reno",
    status: "nuevo",
    scheduled_at: null,
    notes: null,
    created_at: "2026-03-09T12:00:00.000Z",
    updated_at: "2026-03-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("cases helpers", () => {
  it("normalizes the phone input", () => {
    expect(normalizePhone("+51 999-111-222")).toBe("+51999111222");
  });

  it("computes dashboard metrics for open, today, recovered and overdue", () => {
    const cases = [
      makeCase({ id: "open-no-schedule" }),
      makeCase({
        id: "today",
        status: "agendado",
        scheduled_at: "2026-03-10T18:00:00.000Z",
      }),
      makeCase({
        id: "overdue",
        status: "agendado",
        scheduled_at: "2026-03-10T12:00:00.000Z",
      }),
      makeCase({
        id: "recovered",
        status: "recuperado",
        updated_at: "2026-03-08T15:00:00.000Z",
      }),
    ];

    expect(
      computeDashboardSummary(
        cases,
        "America/Lima",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).toEqual({
      openCount: 3,
      todayScheduled: 2,
      recentRecovered: 1,
      overdueCount: 1,
    });
  });

  it("filters overdue and upcoming cases based on local time", () => {
    const upcoming = makeCase({
      status: "agendado",
      scheduled_at: "2026-03-10T18:00:00.000Z",
    });
    const overdue = makeCase({
      status: "agendado",
      scheduled_at: "2026-03-10T12:00:00.000Z",
    });

    expect(
      matchesDateFilter(
        upcoming,
        "upcoming",
        "America/Lima",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      matchesDateFilter(
        overdue,
        "overdue",
        "America/Lima",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("sorts scheduled work before unscheduled cases", () => {
    const ordered = sortCases([
      makeCase({ id: "later", status: "agendado", scheduled_at: "2026-03-12T16:00:00.000Z" }),
      makeCase({ id: "none", updated_at: "2026-03-11T10:00:00.000Z" }),
      makeCase({ id: "first", status: "agendado", scheduled_at: "2026-03-10T16:00:00.000Z" }),
    ]);

    expect(ordered.map((caseItem) => caseItem.id)).toEqual([
      "first",
      "later",
      "none",
    ]);
  });

  it("matches summary presets for recovery", () => {
    const now = new Date("2026-03-10T15:00:00.000Z");

    expect(
      matchesRecoveryPreset(
        makeCase({ status: "contactado" }),
        "open",
        "America/Lima",
        now,
      ),
    ).toBe(true);
    expect(
      matchesRecoveryPreset(
        makeCase({ status: "recuperado", updated_at: "2026-03-08T15:00:00.000Z" }),
        "recovered",
        "America/Lima",
        now,
      ),
    ).toBe(true);
    expect(
      matchesRecoveryPreset(
        makeCase({ status: "agendado", scheduled_at: "2026-03-10T12:00:00.000Z" }),
        "overdue",
        "America/Lima",
        now,
      ),
    ).toBe(true);
  });
});
