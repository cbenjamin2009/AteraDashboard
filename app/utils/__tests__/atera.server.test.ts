import { describe, expect, it } from "vitest";

import { __testables } from "../atera.server";

describe("keyword helpers", () => {
  it("uses fallback when env empty", () => {
    const list = __testables.makeKeywordList("   ", ["closed"]);
    expect(list).toEqual(["closed"]);
  });

  it("parses custom keywords", () => {
    const list = __testables.makeKeywordList("foo, BAR", []);
    expect(list).toEqual(["foo", "bar"]);
  });
});

describe("status filters", () => {
  it("flags closed statuses", () => {
    expect(__testables.isClosedStatus("Closed - done")).toBe(true);
    expect(__testables.isClosedStatus("Resolved")).toBe(true);
    expect(__testables.isClosedStatus("Open")).toBe(false);
  });

  it("counts pending tickets using keywords", () => {
    const data = [
      { TicketStatus: "Waiting on user reply" },
      { TicketStatus: "In-progress" },
      { TicketStatus: "Open" }
    ];
    expect(__testables.countPendingTickets(data as any)).toBe(2);
  });

  it("builds status breakdown excluding closed statuses", () => {
    const data = [
      { TicketStatus: "Open" },
      { TicketStatus: "Open" },
      { TicketStatus: "Pending" },
      { TicketStatus: "Closed" }
    ];
    const breakdown = __testables.buildStatusBreakdown(data as any);
    expect(breakdown).toEqual([
      { status: "Open", count: 2 },
      { status: "Pending", count: 1 }
    ]);
  });
});
