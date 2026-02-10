import { readFile } from "node:fs/promises";
import path from "node:path";

import { addDays, startOfDay, startOfMonth, subDays } from "date-fns";

import type {
  AlertSummary,
  CustomerTicketLoad,
  DashboardMetrics,
  TechnicianWorkload,
  TicketStatusSummary,
  TicketSummary,
  TrendPoint
} from "~/types/dashboard";
import type { BillableEntry, MonthlyReviewMetrics, TicketRow } from "~/types/monthly-review";
import { getServerEnv } from "./env.server";

const API_BASE_URL = "https://app.atera.com/api/v3";
const PAGE_SIZE = 50;
const MAX_PAGES = 40;
const DEFAULT_TTL_MS = 30_000;
const SLA_THRESHOLD_HOURS = 4;
const MONTHLY_CACHE_TTL_MS = Number(process.env.MONTHLY_CACHE_TTL_MS ?? 12 * 60 * 60 * 1000);

const DEFAULT_CLOSED_STATUS_KEYWORDS = ["closed", "resolved", "merged", "deleted", "spam", "cancelled"];
const DEFAULT_PENDING_STATUS_KEYWORDS = [
  "pending",
  "uptime",
  "waiting",
  "waiting on user",
  "waiting on customer",
  "in-progress",
  "closure pending",
  "internal escalation"
];

const CLOSED_STATUS_KEYWORDS = makeKeywordList(process.env.DASH_CLOSED_KEYWORDS, DEFAULT_CLOSED_STATUS_KEYWORDS);
const PENDING_STATUS_KEYWORDS = makeKeywordList(process.env.DASH_PENDING_KEYWORDS, DEFAULT_PENDING_STATUS_KEYWORDS);
const DASHBOARD_FIXTURE = process.env.DASHBOARD_FIXTURE;
let cachedFixtureMetrics: DashboardMetrics | null | undefined;
const monthlyMetricsCache = new Map<string, { metrics: MonthlyReviewMetrics; expiresAt: number }>();

interface TicketsPage<T> {
  items: T[];
  totalItemCount?: number;
  page?: number;
  itemsInPage?: number;
}

interface TicketRecord {
  TicketID: number;
  TicketNumber?: string;
  TicketTitle?: string;
  TicketStatus?: string;
  TicketCreatedDate?: string;
  TicketResolvedDate?: string;
  CustomerName?: string;
  FirstResponseDueDate?: string;
  ClosedTicketDueDate?: string;
  TechnicianFullName?: string;
  TechnicianFirstCommentDate?: string;
  CustomerSurveyRate?: number;
  TotalDurationMinutes?: number;
}

interface AlertRecord {
  AlertID: number;
  Title?: string;
  Severity?: string;
  Created?: string;
  CustomerName?: string;
  DeviceName?: string;
}

interface FetchAllOptions {
  cacheKey?: string;
  ttlMs?: number;
  pageSize?: number;
  maxPages?: number;
}

interface TicketsCollection {
  items: TicketRecord[];
  totalItemCount: number;
}

interface AlertsCollection {
  items: AlertRecord[];
  totalItemCount: number;
}

interface WorkHoursRecord {
  WorkHoursRecordID: number;
  TechnicianFullName?: string;
  BillableDurationMinutes?: number;
  DurationMinutes?: number;
  Billable?: boolean;
}

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

function getCached<T>(key?: string): T | null {
  if (!key) return null;
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  return null;
}

function setCached<T>(key: string | undefined, value: T, ttlMs?: number) {
  if (!key) return;
  memoryCache.set(key, {
    expiresAt: Date.now() + (ttlMs ?? DEFAULT_TTL_MS),
    value
  });
}

function makeKeywordList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

async function loadFixtureMetrics(): Promise<DashboardMetrics | null> {
  if (!DASHBOARD_FIXTURE) {
    return null;
  }

  if (cachedFixtureMetrics !== undefined) {
    return cachedFixtureMetrics;
  }

  const resolvedPath = path.isAbsolute(DASHBOARD_FIXTURE)
    ? DASHBOARD_FIXTURE
    : path.join(process.cwd(), DASHBOARD_FIXTURE);

  try {
    const raw = await readFile(resolvedPath, "utf-8");
    cachedFixtureMetrics = JSON.parse(raw) as DashboardMetrics;
    return cachedFixtureMetrics;
  } catch (error) {
    console.warn("Failed to load DASHBOARD_FIXTURE:", error);
    cachedFixtureMetrics = null;
    return null;
  }
}

async function ateraRequest<T>(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": getServerEnv("ATERA_API_KEY")
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Atera API error (${response.status}): ${message || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchTicketsCollection(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  options: FetchAllOptions = {}
): Promise<TicketsCollection> {
  const cached = getCached<TicketsCollection>(options.cacheKey);
  if (cached) {
    return cached;
  }

  const pageSize = options.pageSize ?? PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES;
  const items: TicketRecord[] = [];
  let declaredTotal: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const pageResult = await ateraRequest<TicketsPage<TicketRecord>>(path, {
      ...params,
      page,
      itemsInPage: pageSize
    });

    if (pageResult.items?.length) {
      items.push(...pageResult.items);
    }

    if (typeof pageResult.totalItemCount === "number") {
      declaredTotal = pageResult.totalItemCount;
    }

    const fetchedAllByTotal = declaredTotal !== null && items.length >= declaredTotal;
    const reachedEnd = !pageResult.items?.length || pageResult.items.length < pageSize;

    if (fetchedAllByTotal || reachedEnd) {
      break;
    }
  }

  const collection: TicketsCollection = {
    items,
    totalItemCount: declaredTotal ?? items.length
  };

  setCached(options.cacheKey, collection, options.ttlMs);
  return collection;
}

async function fetchAlertsCollection(
  params: Record<string, string | number | boolean | undefined>,
  options: FetchAllOptions = {}
): Promise<AlertsCollection> {
  const cached = getCached<AlertsCollection>(options.cacheKey);
  if (cached) {
    return cached;
  }

  const result = await ateraRequest<TicketsPage<AlertRecord>>("/alerts", {
    ...params,
    page: 1,
    itemsInPage: options.pageSize ?? PAGE_SIZE
  });

  const collection: AlertsCollection = {
    items: result.items ?? [],
    totalItemCount: result.totalItemCount ?? result.items?.length ?? 0
  };

  setCached(options.cacheKey, collection, options.ttlMs);
  return collection;
}

async function fetchWorkHoursRecords(ticketId: number): Promise<WorkHoursRecord[]> {
  try {
    return await ateraRequest<WorkHoursRecord[]>(`/tickets/${ticketId}/workhoursrecords`, {});
  } catch (error) {
    console.warn(`Failed to load work hours for ticket ${ticketId}`, error);
    return [];
  }
}

function mapTicketSummary(ticket: TicketRecord): TicketSummary {
  return {
    id: ticket.TicketID,
    number: ticket.TicketNumber,
    title: ticket.TicketTitle,
    status: ticket.TicketStatus,
    customer: ticket.CustomerName,
    createdAt: ticket.TicketCreatedDate
  };
}

function mapAlertSummary(alert: AlertRecord): AlertSummary {
  return {
    id: alert.AlertID,
    title: alert.Title,
    customer: alert.CustomerName,
    device: alert.DeviceName,
    createdAt: alert.Created
  };
}

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function isClosedStatus(status?: string) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return CLOSED_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function buildTechnicianLoad(tickets: TicketRecord[]): TechnicianWorkload[] {
  const load = new Map<string, number>();
  for (const ticket of tickets) {
    const key = ticket.TechnicianFullName?.trim() || "Unassigned";
    load.set(key, (load.get(key) ?? 0) + 1);
  }

  return Array.from(load.entries())
    .map(([technician, count]) => ({ technician, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildTrend(tickets: TicketRecord[], windowStart: Date, totalDays: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const dayStart = addDays(windowStart, i);
    const dayEnd = addDays(dayStart, 1);
    const opened = tickets.filter((ticket) => {
      const created = parseDate(ticket.TicketCreatedDate);
      return created && created >= dayStart && created < dayEnd;
    }).length;

    const closed = tickets.filter((ticket) => {
      const resolved = parseDate(ticket.TicketResolvedDate);
      return resolved && resolved >= dayStart && resolved < dayEnd;
    }).length;

    points.push({
      date: dayStart.toISOString(),
      opened,
      closed
    });
  }

  return points;
}

function buildCustomerLoads(tickets: TicketRecord[], from: Date): CustomerTicketLoad[] {
  const load = new Map<string, number>();
  for (const ticket of tickets) {
    const created = parseDate(ticket.TicketCreatedDate);
    if (!created || created < from) continue;
    const key = ticket.CustomerName?.trim() || "Unassigned";
    load.set(key, (load.get(key) ?? 0) + 1);
  }

  return Array.from(load.entries())
    .map(([customer, count]) => ({ customer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildStatusBreakdown(tickets: TicketRecord[]): TicketStatusSummary[] {
  const map = new Map<string, number>();
  for (const ticket of tickets) {
    const status = ticket.TicketStatus?.trim() || "Unknown";
    if (isClosedStatus(status)) {
      continue;
    }
    map.set(status, (map.get(status) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function countPendingTickets(tickets: TicketRecord[]): number {
  return tickets.filter((ticket) => {
    const status = ticket.TicketStatus?.toLowerCase();
    if (!status) return false;
    return PENDING_STATUS_KEYWORDS.some((keyword) => status.includes(keyword));
  }).length;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const KEYWORD_STOPWORDS = new Set(["the", "a", "of", "for", "and", "to", "in", "on", "with", "issue", "ticket"]);

function resolveMonthRange(monthIso: string) {
  const [yearStr, monthStr] = monthIso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  const monthLabel = MONTH_FORMATTER.format(startDate);
  return { startDate, endDate, monthLabel };
}

function minutesBetween(start?: string, end?: string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  const diff = (endDate.getTime() - startDate.getTime()) / 60000;
  return diff >= 0 ? diff : null;
}

function buildKeywordCloudFromTickets(tickets: TicketRecord[]) {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const title = ticket.TicketTitle ?? "";
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word && !KEYWORD_STOPWORDS.has(word))
      .forEach((word) => {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      });
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

async function aggregateBillableHours(tickets: TicketRecord[]) {
  const technicianMap = new Map<string, number>();
  let totalMinutes = 0;

  for (const ticket of tickets) {
    const records = await fetchWorkHoursRecords(ticket.TicketID);
    for (const entry of records) {
      const minutes =
        entry.BillableDurationMinutes ??
        (entry.Billable ? entry.DurationMinutes ?? 0 : 0);
      if (!minutes) continue;
      totalMinutes += minutes;
      const technician = entry.TechnicianFullName ?? "Unassigned";
      technicianMap.set(technician, (technicianMap.get(technician) ?? 0) + minutes);
    }
  }

  const entries: BillableEntry[] = Array.from(technicianMap.entries()).map(([technician, minutes]) => ({
    technician,
    hours: Number((minutes / 60).toFixed(1))
  }));

  return {
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    entries: entries.sort((a, b) => b.hours - a.hours)
  };
}

export async function getMonthlyReviewMetrics(monthIso: string): Promise<MonthlyReviewMetrics> {
  const { startDate, endDate, monthLabel } = resolveMonthRange(monthIso);
  const { items } = await fetchTicketsCollection(
    "/tickets/lastmodified",
    { date: startDate.toISOString(), includeComments: false },
    {
      cacheKey: `tickets:monthly:${startDate.toISOString()}`,
      ttlMs: DEFAULT_TTL_MS * 5,
      maxPages: 50
    }
  );

  const monthlyTickets = items.filter((ticket) => {
    const created = parseDate(ticket.TicketCreatedDate);
    return created && created >= startDate && created < endDate;
  });

  const totalTickets = monthlyTickets.length;

  const firstResponses = monthlyTickets
    .map((ticket) => minutesBetween(ticket.TicketCreatedDate, ticket.TechnicianFirstCommentDate))
    .filter((value): value is number => typeof value === "number");

  const resolutions = monthlyTickets
    .map((ticket) => minutesBetween(ticket.TicketCreatedDate, ticket.TicketResolvedDate))
    .filter((value): value is number => typeof value === "number");

  const avgFirstResponseMinutes = firstResponses.length
    ? Number((firstResponses.reduce((acc, val) => acc + val, 0) / firstResponses.length).toFixed(1))
    : 0;

  const avgResolutionMinutes = resolutions.length
    ? Number((resolutions.reduce((acc, val) => acc + val, 0) / resolutions.length).toFixed(1))
    : 0;

  const satisfactionValues = monthlyTickets
    .map((ticket) => (typeof ticket.CustomerSurveyRate === "number" ? ticket.CustomerSurveyRate : null))
    .filter((value): value is number => value !== null);

  const satisfactionScore = satisfactionValues.length
    ? Number((satisfactionValues.reduce((acc, val) => acc + val, 0) / satisfactionValues.length).toFixed(1))
    : 0;

  const responseWithinTwoHoursCount = firstResponses.filter((minutes) => minutes <= 120).length;
  const closureWithinTwoDaysCount = resolutions.filter((minutes) => minutes <= 2880).length;

  const responseWithin2Hours = {
    count: responseWithinTwoHoursCount,
    percentage: totalTickets ? Number(((responseWithinTwoHoursCount / totalTickets) * 100).toFixed(1)) : 0
  };

  const closureWithinTwoDays = {
    count: closureWithinTwoDaysCount,
    percentage: totalTickets ? Number(((closureWithinTwoDaysCount / totalTickets) * 100).toFixed(1)) : 0
  };

  const billableHours = await aggregateBillableHours(monthlyTickets);
  const keywordCloud = buildKeywordCloudFromTickets(monthlyTickets);

  const tickets: TicketRow[] = monthlyTickets.map((ticket) => ({
    id: ticket.TicketID,
    number: ticket.TicketNumber,
    title: ticket.TicketTitle,
    customer: ticket.CustomerName,
    status: ticket.TicketStatus,
    opened: ticket.TicketCreatedDate,
    firstResponseMinutes: minutesBetween(ticket.TicketCreatedDate, ticket.TechnicianFirstCommentDate) ?? undefined,
    resolutionMinutes: minutesBetween(ticket.TicketCreatedDate, ticket.TicketResolvedDate) ?? undefined,
    satisfaction: typeof ticket.CustomerSurveyRate === "number" ? ticket.CustomerSurveyRate : undefined
  }));

  return {
    monthLabel,
    totalTickets,
    avgFirstResponseMinutes,
    avgResolutionMinutes,
    satisfactionScore,
    responseWithin2Hours,
    closureWithinTwoDays,
    billableHours,
    keywordCloud,
    tickets
  };
}

interface MonthlyMetricsOptions {
  fixturePath?: string;
  forceRefresh?: boolean;
}

export async function fetchMonthlyReviewMetrics(
  monthIso: string,
  options: MonthlyMetricsOptions = {}
): Promise<MonthlyReviewMetrics | null> {
  const cacheKey = `monthly:${monthIso}`;
  if (!options.forceRefresh) {
    const cached = monthlyMetricsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.metrics;
    }
  }

  try {
    const metrics = await getMonthlyReviewMetrics(monthIso);
    monthlyMetricsCache.set(cacheKey, {
      metrics,
      expiresAt: Date.now() + MONTHLY_CACHE_TTL_MS
    });
    return metrics;
  } catch (error) {
    console.error("Failed to load monthly review metrics from API", error);
    if (!options.fixturePath) {
      monthlyMetricsCache.delete(cacheKey);
      return null;
    }
    const { loadJsonFixture } = await import("./fixture.server");
    const fallback = await loadJsonFixture<MonthlyReviewMetrics>(options.fixturePath);
    if (fallback) {
      monthlyMetricsCache.set(cacheKey, {
        metrics: fallback,
        expiresAt: Date.now() + MONTHLY_CACHE_TTL_MS
      });
    }
    return fallback;
  }
}

export async function getDashboardMetrics(now = new Date()): Promise<DashboardMetrics> {
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const sevenDaysAgo = subDays(todayStart, 7);
  const thirtyDaysAgo = subDays(todayStart, 30);

  const fixtureMetrics = await loadFixtureMetrics();
  if (fixtureMetrics) {
    return fixtureMetrics;
  }

  const [allTickets, modifiedToday, modifiedThisMonth, openAlerts] = await Promise.all([
    fetchTicketsCollection(
      "/tickets",
      {},
      { cacheKey: "tickets:open", ttlMs: DEFAULT_TTL_MS }
    ),
    fetchTicketsCollection(
      "/tickets/lastmodified",
      { date: todayStart.toISOString(), includeComments: false },
      {
        cacheKey: `tickets:lastmodified:${todayStart.toISOString()}`,
        ttlMs: DEFAULT_TTL_MS,
        maxPages: 10
      }
    ),
    fetchTicketsCollection(
      "/tickets/lastmodified",
      { date: monthStart.toISOString(), includeComments: false },
      {
        cacheKey: `tickets:lastmodified:${monthStart.toISOString()}`,
        ttlMs: DEFAULT_TTL_MS,
        maxPages: 20
      }
    ),
    fetchAlertsCollection(
      { alertStatus: "Open" },
      { cacheKey: "alerts:open", ttlMs: DEFAULT_TTL_MS, pageSize: 100 }
    )
  ]);

  const openTickets: TicketsCollection = {
    items: allTickets.items.filter((ticket) => !isClosedStatus(ticket.TicketStatus)),
    totalItemCount: 0
  };
  openTickets.totalItemCount = openTickets.items.length;

  const newToday = modifiedToday.items.filter((ticket) => {
    const created = parseDate(ticket.TicketCreatedDate);
    return created && created >= todayStart;
  }).length;

  const closedThisMonth = modifiedThisMonth.items.filter((ticket) => {
    const resolved = parseDate(ticket.TicketResolvedDate);
    if (!resolved || resolved < monthStart) {
      return false;
    }
    const status = (ticket.TicketStatus ?? "").toLowerCase();
    return status.includes("closed") || status.includes("resolved");
  }).length;

  const openThisMonth = openTickets.items.filter((ticket) => {
    const created = parseDate(ticket.TicketCreatedDate);
    return created && created >= monthStart;
  }).length;

  const sortedOpen = [...openTickets.items].sort((a, b) => {
    const aTime = parseDate(a.TicketCreatedDate)?.valueOf() ?? Number.POSITIVE_INFINITY;
    const bTime = parseDate(b.TicketCreatedDate)?.valueOf() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  const recentOpen = openTickets.items.filter((ticket) => {
    const created = parseDate(ticket.TicketCreatedDate);
    return created && created >= thirtyDaysAgo;
  });

  const totalHoursOpen = recentOpen.reduce((acc, ticket) => {
    const created = parseDate(ticket.TicketCreatedDate);
    if (!created) return acc;
    const diffHours = (now.getTime() - created.getTime()) / 3_600_000;
    return acc + diffHours;
  }, 0);

  const averageOpenAgeHours = recentOpen.length ? Number((totalHoursOpen / recentOpen.length).toFixed(1)) : 0;

  const nowMs = now.getTime();
  const slaThresholdMs = SLA_THRESHOLD_HOURS * 3_600_000;
  const slaRiskCount = openTickets.items.filter((ticket) => {
    const dueDate = parseDate(ticket.FirstResponseDueDate ?? ticket.ClosedTicketDueDate);
    if (!dueDate) return false;
    const diff = dueDate.getTime() - nowMs;
    return diff <= slaThresholdMs && diff >= -slaThresholdMs;
  }).length;

  const technicianLoad = buildTechnicianLoad(openTickets.items);
  const trendSevenDay = buildTrend(modifiedThisMonth.items, subDays(todayStart, 6), 7);
  const newTicketsByCustomer = buildCustomerLoads(modifiedThisMonth.items, sevenDaysAgo);
  const statusBreakdown = buildStatusBreakdown(openTickets.items);
  const pendingTickets = countPendingTickets(openTickets.items);

  const criticalAlerts = openAlerts.items
    .filter((alert) => (alert.Severity ?? "").toLowerCase() === "critical")
    .sort((a, b) => {
      const aTime = parseDate(a.Created)?.valueOf() ?? 0;
      const bTime = parseDate(b.Created)?.valueOf() ?? 0;
      return bTime - aTime;
    });

  return {
    generatedAt: now.toISOString(),
    openTotal: openTickets.totalItemCount,
    newToday,
    openThisMonth,
    closedThisMonth,
    pendingTickets,
    averageOpenAgeHours,
    slaRiskCount,
    technicianLoad,
    trendSevenDay,
    newTicketsByCustomer,
    statusBreakdown,
    criticalAlertsOpen: criticalAlerts.length,
    criticalAlertsSample: criticalAlerts.slice(0, 5).map(mapAlertSummary),
    sampleOpenTickets: sortedOpen.slice(0, 8).map(mapTicketSummary)
  };
}

export const __testables = {
  makeKeywordList,
  isClosedStatus,
  countPendingTickets,
  buildStatusBreakdown
};
