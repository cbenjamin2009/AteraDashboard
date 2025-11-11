import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "@remix-run/react";

import MetricCard from "~/components/metric-card";
import StatusBanner from "~/components/status-banner";
import TicketList from "~/components/ticket-list";
import type { DashboardMetrics } from "~/types/dashboard";
import { getDashboardMetrics } from "~/utils/atera.server";

type ClientConfig = {
  refreshIntervalMs: number;
  staleAfterMs: number;
};

const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  refreshIntervalMs: 60_000,
  staleAfterMs: 300_000
};

const METRIC_THRESHOLDS = {
  openTotal: { direction: "low", warning: 10, danger: 15 },
  openThisMonth: { direction: "low", warning: 8, danger: 12 },
  newToday: { direction: "low", warning: 5, danger: 10 },
  pendingTickets: { direction: "low", warning: 3, danger: 6 },
  closedThisMonth: { direction: "high", warning: 8, danger: 5 },
  averageOpenAgeHours: { direction: "low", warning: 24, danger: 48 },
  slaRiskCount: { direction: "low", warning: 1, danger: 3 },
  criticalAlertsOpen: { direction: "low", warning: 1, danger: 2 }
} as const;

type MetricKey = keyof typeof METRIC_THRESHOLDS;
type StoplightAccent = "success" | "warning" | "danger" | "neutral";

function getStoplightAccent(key: MetricKey, value: number | null | undefined): StoplightAccent {
  const config = METRIC_THRESHOLDS[key];
  if (!config || value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }

  if (config.direction === "low") {
    if (value >= config.danger) return "danger";
    if (value >= config.warning) return "warning";
    return "success";
  }

  if (value <= config.danger) return "danger";
  if (value <= config.warning) return "warning";
  return "success";
}

type LoaderData =
  | { ok: true; metrics: DashboardMetrics; clientConfig: ClientConfig }
  | { ok: false; error: string; clientConfig: ClientConfig };

export async function loader({}: LoaderFunctionArgs) {
  const refreshIntervalMs = Number(process.env.DASH_REFRESH_INTERVAL_MS ?? DEFAULT_CLIENT_CONFIG.refreshIntervalMs);
  const staleAfterMs = Number(process.env.DASH_STALE_AFTER_MS ?? DEFAULT_CLIENT_CONFIG.staleAfterMs);
  const clientConfig: ClientConfig = { refreshIntervalMs, staleAfterMs };

  try {
    const metrics = await getDashboardMetrics();
    return json<LoaderData>({ ok: true, metrics, clientConfig });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json<LoaderData>({ ok: false, error: message, clientConfig }, { status: 500 });
  }
}

function formatAverageAge(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "Fresh queue";
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

function formatDayLabel(isoDate: string) {
  return new Date(isoDate).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function DashboardRoute() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handle = setInterval(() => {
      if (document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }, data.clientConfig.refreshIntervalMs);
    return () => clearInterval(handle);
  }, [data.clientConfig.refreshIntervalMs, revalidator]);

  if (!data.ok) {
    return (
      <main>
        <div className="dashboard-shell">
          <header>
            <h1>Rush IT Operations Dashboard</h1>
            <p>Could not load data from the Atera API.</p>
          </header>
          <section className="tickets-panel">
            <h2>Troubleshooting</h2>
            <p>{data.error}</p>
            <ul>
              <li>Verify that the `ATERA_API_KEY` value is present in your .env file.</li>
              <li>Ensure the key has the required permissions to read tickets.</li>
            </ul>
          </section>
        </div>
      </main>
    );
  }

  const { metrics } = data;
  const config = data.clientConfig;
  const isRefreshing = revalidator.state !== "idle";
  const isStale = nowTs - new Date(metrics.generatedAt).getTime() > config.staleAfterMs;
  const staleMinutes = ((nowTs - new Date(metrics.generatedAt).getTime()) / 60000).toFixed(1);
  const autoRefreshSeconds = Math.round(config.refreshIntervalMs / 1000);
  const maxCustomerCount = Math.max(
    ...metrics.newTicketsByCustomer.map((entry) => entry.count),
    1
  );
  const maxStatusCount = Math.max(...metrics.statusBreakdown.map((entry) => entry.count), 1);
  const maxTrendValue = Math.max(
    ...metrics.trendSevenDay.map((point) => Math.max(point.opened, point.closed)),
    1
  );

  const renderBar = (value: number, max: number) => (
    <div className="bar-track">
      <span className="bar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );

  const renderMetricCell = (value: number) => (
    <div className="table-metric">
      <span>{value}</span>
      {renderBar(value, maxTrendValue)}
    </div>
  );

  const openTotalAccent = getStoplightAccent("openTotal", metrics.openTotal);
  const openThisMonthAccent = getStoplightAccent("openThisMonth", metrics.openThisMonth);
  const newTodayAccent = getStoplightAccent("newToday", metrics.newToday);
  const pendingAccent = getStoplightAccent("pendingTickets", metrics.pendingTickets);
  const closedThisMonthAccent = getStoplightAccent("closedThisMonth", metrics.closedThisMonth);
  const avgAgeAccent = getStoplightAccent("averageOpenAgeHours", metrics.averageOpenAgeHours);
  const avgAgeDisplay = formatAverageAge(metrics.averageOpenAgeHours);
  const slaRiskAccent = getStoplightAccent("slaRiskCount", metrics.slaRiskCount);
  const criticalAlertAccent = getStoplightAccent("criticalAlertsOpen", metrics.criticalAlertsOpen);

  const refreshedAt = new Date(metrics.generatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return (
    <main>
      <div className="dashboard-shell">
        <header>
          <h1>Atera Operations Dashboard</h1>
          <p>Live ticket KPIs refresh automatically every {autoRefreshSeconds} seconds.</p>
        </header>

        <div className="meta-row">
          <span>Last synced: {refreshedAt}</span>
          <span>Auto-refresh every {autoRefreshSeconds}s</span>
        </div>

        <div className="banner-stack">
          {isRefreshing ? <StatusBanner message="Refreshing latest data from Atera..." variant="info" /> : null}
          {isStale ? (
            <StatusBanner
              message={`Live data is ${staleMinutes} minutes old. Check API connectivity if this persists.`}
              variant="warning"
            />
          ) : null}
        </div>

        <section className="metrics-grid">
          <MetricCard label="Open Tickets" value={metrics.openTotal} helper="Currently assigned" accent={openTotalAccent} />
          <MetricCard
            label="Opened This Month"
            value={metrics.openThisMonth}
            helper="Still awaiting closure"
            accent="warning"
          />
          <MetricCard
            label="New Tickets Today"
            value={metrics.newToday}
            helper="Created since midnight"
            accent="success"
          />
          <MetricCard
            label="Pending Tickets"
            value={metrics.pendingTickets}
            helper="Waiting on external action"
            accent="warning"
          />
          <MetricCard
            label="Closed This Month"
            value={metrics.closedThisMonth}
            helper="Resolved + closed"
            accent="neutral"
          />
          <MetricCard
            label="Avg Age (30d)"
            value={formatAverageAge(metrics.averageOpenAgeHours)}
            helper="Active tickets opened within 30 days"
          />
          <MetricCard
            label="SLA at Risk (+/- 4h)"
            value={metrics.slaRiskCount}
            helper="Due soon or just breached"
            accent="warning"
          />
          <MetricCard
            label="Critical Alerts"
            value={metrics.criticalAlertsOpen}
            helper="Open RMM alerts (critical)"
            accent="warning"
          />
        </section>

        <section className="panels-grid">
          <section className="tickets-panel">
            <h2>Technician workload</h2>
            {metrics.technicianLoad.length === 0 ? (
              <p>No active assignments.</p>
            ) : (
              <ul className="stat-list">
                {metrics.technicianLoad.map((item) => (
                  <li key={item.technician}>
                    <span>{item.technician}</span>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tickets-panel">
            <h2>Critical alerts</h2>
            {metrics.criticalAlertsSample.length === 0 ? (
              <p>All quiet on the alert front.</p>
            ) : (
              <ul className="stat-list">
                {metrics.criticalAlertsSample.map((alert) => (
                  <li key={alert.id}>
                    <div>
                      <span className="list-label">{alert.title ?? "Unnamed alert"}</span>
                      <span className="list-sub">
                        {alert.customer ?? "Unknown customer"} / {alert.device ?? "device unknown"}
                      </span>
                    </div>
                    <span className="list-meta">
                      {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <section className="tickets-panel">
          <h2>Tickets opened vs closed (last 7 days)</h2>
          {metrics.trendSevenDay.length === 0 ? (
            <p>No historical activity captured for the window.</p>
          ) : (
            <table className="trend-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Opened</th>
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                {metrics.trendSevenDay.map((point) => (
              <tr key={point.date}>
                <td>{formatDayLabel(point.date)}</td>
                <td>{renderMetricCell(point.opened)}</td>
                <td>{renderMetricCell(point.closed)}</td>
              </tr>
            ))}
          </tbody>
            </table>
          )}
        </section>

        <section className="tickets-panel">
          <h2>New tickets by customer (7 days)</h2>
          {metrics.newTicketsByCustomer.length === 0 ? (
            <p>Only light ticket volume this week.</p>
          ) : (
            <ul className="stat-list compact metered">
              {metrics.newTicketsByCustomer.map((entry) => (
                <li key={entry.customer}>
                  <div className="stat-row">
                    <span>{entry.customer}</span>
                    <strong>{entry.count}</strong>
                  </div>
                  {renderBar(entry.count, maxCustomerCount)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tickets-panel">
          <h2>Tickets by status</h2>
          {metrics.statusBreakdown.length === 0 ? (
            <p>No active statuses to report.</p>
          ) : (
            <ul className="stat-list compact metered">
              {metrics.statusBreakdown.map((entry) => (
                <li key={entry.status}>
                  <div className="stat-row">
                    <span>{entry.status}</span>
                    <strong>{entry.count}</strong>
                  </div>
                  {renderBar(entry.count, maxStatusCount)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <TicketList
          title="Oldest open tickets"
          tickets={metrics.sampleOpenTickets}
          emptyMessage="No open tickets right now."
        />
      </div>
    </main>
  );
}






