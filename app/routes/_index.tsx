import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect } from "react";
import { useLoaderData, useRevalidator } from "@remix-run/react";

import MetricCard from "~/components/metric-card";
import TicketList from "~/components/ticket-list";
import type { DashboardMetrics } from "~/types/dashboard";
import { getDashboardMetrics } from "~/utils/atera.server";

const REFRESH_INTERVAL_MS = 60_000;

type LoaderData =
  | { ok: true; metrics: DashboardMetrics }
  | { ok: false; error: string };

export async function loader({}: LoaderFunctionArgs) {
  try {
    const metrics = await getDashboardMetrics();
    return json<LoaderData>({ ok: true, metrics });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json<LoaderData>({ ok: false, error: message }, { status: 500 });
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

  useEffect(() => {
    const handle = setInterval(() => {
      if (document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [revalidator]);

  if (!data.ok) {
    return (
      <main>
        <div className="dashboard-shell">
          <header>
            <h1>Atera Operations Dashboard</h1>
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
          <p>Live ticket KPIs refresh automatically every minute.</p>
        </header>

        <section className="metrics-grid">
          <MetricCard label="Open Tickets" value={metrics.openTotal} helper="Currently assigned" />
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
                    <td>{point.opened}</td>
                    <td>{point.closed}</td>
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
            <ul className="stat-list compact">
              {metrics.newTicketsByCustomer.map((entry) => (
                <li key={entry.customer}>
                  <span>{entry.customer}</span>
                  <strong>{entry.count}</strong>
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
            <ul className="stat-list compact">
              {metrics.statusBreakdown.map((entry) => (
                <li key={entry.status}>
                  <span>{entry.status}</span>
                  <strong>{entry.count}</strong>
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

        <div className="footer-meta">
          <span>Last synced: {refreshedAt}</span>
          <span>Auto-refresh every 60s</span>
        </div>
      </div>
    </main>
  );
}
