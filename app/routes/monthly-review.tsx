import { Form, useLoaderData } from "@remix-run/react";

import MetricCard from "~/components/metric-card";
import type { MonthlyReviewLoaderData } from "~/routes/monthly-review.server";

export { loader } from "~/routes/monthly-review.server";

function minutesToFriendly(minutes?: number | null) {
  if (!Number.isFinite(minutes) || !minutes || minutes <= 0) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function MonthlyReviewRoute() {
  const { metrics, selectedMonth, page, totalPages, pageSize } =
    useLoaderData<MonthlyReviewLoaderData>();
  const tableStart = (page - 1) * pageSize;
  const visibleTickets = metrics.tickets.slice(tableStart, tableStart + pageSize);
  const showingFrom = metrics.tickets.length ? tableStart + 1 : 0;
  const showingTo = Math.min(tableStart + pageSize, metrics.tickets.length);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="dashboard-shell">
      <header>
        <h1>Monthly Review</h1>
        <div className="meta-row">
          <span>{metrics.monthLabel}</span>
          <Form method="get" className="month-filter">
            <label>
              Month
              <input type="month" name="month" defaultValue={selectedMonth} />
            </label>
            <input type="hidden" name="page" value="1" />
            <div className="month-filter__actions">
              <button type="submit" className="btn-primary">
                Update
              </button>
              <button type="submit" name="refresh" value="1" className="btn-ghost">
                Refresh data
              </button>
            </div>
          </Form>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Total Tickets" value={metrics.totalTickets} helper={metrics.monthLabel} />
        <MetricCard
          label="Avg First Response"
          value={minutesToFriendly(metrics.avgFirstResponseMinutes)}
          helper="Technician replies"
        />
        <MetricCard
          label="Avg Resolution Time"
          value={minutesToFriendly(metrics.avgResolutionMinutes)}
          helper="Ticket lifecycle"
        />
        <MetricCard
          label="Satisfaction"
          value={`${metrics.satisfactionScore.toFixed(1)}/5`}
          helper="Customer rating"
        />
        <MetricCard
          label="Responded <2h"
          value={`${metrics.responseWithin2Hours.count} (${formatPercentage(metrics.responseWithin2Hours.percentage)})`}
          helper="SLA compliance"
        />
        <MetricCard
          label="Closed <2d"
          value={`${metrics.closureWithinTwoDays.count} (${formatPercentage(metrics.closureWithinTwoDays.percentage)})`}
          helper="Resolution speed"
        />
        <MetricCard
          label="Billable Hours"
          value={metrics.billableHours.totalHours.toFixed(1)}
          helper="Tracked entries"
        />
      </section>

      <section className="panels-grid">
        <article className="tickets-panel">
          <h2>Billable hours by technician</h2>
          {metrics.billableHours.entries.length === 0 ? (
            <p>No time entries recorded.</p>
          ) : (
            <ul className="stat-list compact">
              {metrics.billableHours.entries.map((entry) => (
                <li key={entry.technician}>
                  <span>{entry.technician}</span>
                  <strong>{entry.hours.toFixed(1)}h</strong>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="tickets-panel">
          <h2>Keyword trends</h2>
          {metrics.keywordCloud.length === 0 ? (
            <p>No keyword data.</p>
          ) : (
            <div className="keyword-cloud">
              {metrics.keywordCloud.map((keyword) => (
                <span
                  key={keyword.label}
                  className="keyword-pill"
                  style={{ fontSize: `${Math.min(2.8, 1 + keyword.count * 0.15)}rem` }}
                >
                  {keyword.label}
                </span>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="tickets-panel">
        <h2>Tickets for {metrics.monthLabel}</h2>
        {metrics.tickets.length === 0 ? (
          <p>No tickets found for this month.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>tickets.ticket_id</th>
                  <th>Title</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>First Response</th>
                  <th>Resolution</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.number ?? ticket.id}</td>
                    <td>{ticket.title}</td>
                    <td>{ticket.customer}</td>
                    <td>{ticket.status}</td>
                    <td>{ticket.opened ? new Date(ticket.opened).toLocaleDateString() : "-"}</td>
                    <td>{minutesToFriendly(ticket.firstResponseMinutes)}</td>
                    <td>{minutesToFriendly(ticket.resolutionMinutes)}</td>
                    <td>{ticket.satisfaction ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-pagination">
              <span>
                Showing {showingFrom}-{showingTo} of {metrics.tickets.length}
              </span>
              <div className="pagination-buttons">
                <Form method="get">
                  <input type="hidden" name="month" value={selectedMonth} />
                  <input type="hidden" name="page" value={Math.max(1, page - 1)} />
                  <button type="submit" disabled={!hasPrev}>
                    Previous
                  </button>
                </Form>
                <span>
                  Page {page} / {totalPages}
                </span>
                <Form method="get">
                  <input type="hidden" name="month" value={selectedMonth} />
                  <input type="hidden" name="page" value={Math.min(totalPages, page + 1)} />
                  <button type="submit" disabled={!hasNext}>
                    Next
                  </button>
                </Form>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}



