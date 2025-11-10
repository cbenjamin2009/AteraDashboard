import type { TicketSummary } from "~/types/dashboard";

interface TicketListProps {
  title: string;
  tickets: TicketSummary[];
  emptyMessage?: string;
}

export function TicketList({ title, tickets, emptyMessage }: TicketListProps) {
  if (!tickets.length) {
    return (
      <section className="tickets-panel">
        <h2>{title}</h2>
        <p>{emptyMessage ?? "No tickets to show."}</p>
      </section>
    );
  }

  return (
    <section className="tickets-panel">
      <h2>{title}</h2>
      <table className="ticket-table">
        <thead>
          <tr>
            <th>tickets.ticket_id</th>
            <th>Title</th>
            <th>Customer</th>
            <th>Created</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const created = ticket.createdAt
              ? new Date(ticket.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "-";
            const variant = (ticket.status ?? "").toLowerCase().includes("new") ? "new" : "open";

            const ticketId = String(ticket.id);
            const ticketUrl = `https://app.atera.com/new/ticket/${encodeURIComponent(ticketId)}`;

            return (
              <tr key={ticket.id}>
                <td>
                  <a className="ticket-link" href={ticketUrl} target="_blank" rel="noreferrer">
                    {ticketId}
                  </a>
                </td>
                <td>{ticket.title ?? "Untitled"}</td>
                <td>{ticket.customer ?? "-"}</td>
                <td>{created}</td>
                <td>
                  <span className="status-pill" data-variant={variant}>
                    {ticket.status ?? "Unknown"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default TicketList;
