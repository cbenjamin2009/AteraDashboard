import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import type { MonthlyReviewMetrics } from "~/types/monthly-review";
import { fetchMonthlyReviewMetrics } from "~/utils/atera.server";

const MONTHLY_FIXTURE_PATH = process.env.MONTHLY_REVIEW_FIXTURE ?? "fixtures/monthly-review.sample.json";

const DEFAULT_MONTHLY_METRICS: MonthlyReviewMetrics = {
  monthLabel: "Current Month",
  totalTickets: 0,
  avgFirstResponseMinutes: 0,
  avgResolutionMinutes: 0,
  satisfactionScore: 0,
  responseWithin2Hours: { count: 0, percentage: 0 },
  closureWithinTwoDays: { count: 0, percentage: 0 },
  billableHours: { totalHours: 0, entries: [] },
  keywordCloud: [],
  tickets: []
};

export type MonthlyReviewLoaderData = {
  metrics: MonthlyReviewMetrics;
  selectedMonth: string;
  page: number;
  totalPages: number;
  pageSize: number;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = monthParam ?? defaultMonth;
  const pageSize = 25;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const metrics =
    (await fetchMonthlyReviewMetrics(selectedMonth, {
      fixturePath: MONTHLY_FIXTURE_PATH,
      forceRefresh
    })) ?? DEFAULT_MONTHLY_METRICS;

  const totalPages = Math.max(1, Math.ceil(metrics.tickets.length / pageSize));
  const safePage = Math.min(page, totalPages);

  return json<MonthlyReviewLoaderData>({
    metrics,
    selectedMonth,
    page: safePage,
    totalPages,
    pageSize
  });
}
