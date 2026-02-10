import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

import { loader } from "~/routes/monthly-review.server";
import type { MonthlyReviewMetrics } from "~/types/monthly-review";

vi.mock("~/utils/atera.server", () => ({
  fetchMonthlyReviewMetrics: vi.fn()
}));

const { fetchMonthlyReviewMetrics } = await import("~/utils/atera.server");

const baseMetrics: MonthlyReviewMetrics = {
  monthLabel: "January 2025",
  totalTickets: 10,
  avgFirstResponseMinutes: 30,
  avgResolutionMinutes: 600,
  satisfactionScore: 4.5,
  responseWithin2Hours: { count: 8, percentage: 80 },
  closureWithinTwoDays: { count: 7, percentage: 70 },
  billableHours: { totalHours: 12, entries: [] },
  keywordCloud: [],
  tickets: Array.from({ length: 40 }).map((_, idx) => ({
    id: idx + 1,
    number: `T-${idx + 1}`,
    title: `Ticket ${idx + 1}`,
    customer: "Acme",
    status: "Closed",
    opened: "2025-01-01T00:00:00.000Z"
  }))
};

function createRequest(url: string) {
  return new Request(url);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("monthly review loader", () => {
  it("returns API metrics with pagination", async () => {
    (fetchMonthlyReviewMetrics as Mock).mockResolvedValueOnce(baseMetrics);

    const response = await loader({ request: createRequest("http://localhost/monthly-review?page=2&month=2025-01") } as any);
    const data = await response.json();

    expect(fetchMonthlyReviewMetrics).toHaveBeenCalledWith(
      "2025-01",
      expect.objectContaining({
        fixturePath: expect.any(String),
        forceRefresh: false
      })
    );
    expect(data.selectedMonth).toBe("2025-01");
    expect(data.page).toBe(2);
    expect(data.totalPages).toBe(2);
    expect(data.metrics.totalTickets).toBe(10);
  });

  it("falls back to default metrics when API returns null", async () => {
    (fetchMonthlyReviewMetrics as Mock).mockResolvedValueOnce(null);

    const response = await loader({ request: createRequest("http://localhost/monthly-review") } as any);
    const data = await response.json();

    expect(fetchMonthlyReviewMetrics).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        fixturePath: expect.any(String),
        forceRefresh: false
      })
    );
    expect(data.metrics.totalTickets).toBe(0);
    expect(data.page).toBe(1);
  });

  it("forces refresh when refresh param is provided", async () => {
    (fetchMonthlyReviewMetrics as Mock).mockResolvedValueOnce(baseMetrics);

    await loader({ request: createRequest("http://localhost/monthly-review?refresh=1") } as any);

    expect(fetchMonthlyReviewMetrics).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        forceRefresh: true
      })
    );
  });
});

