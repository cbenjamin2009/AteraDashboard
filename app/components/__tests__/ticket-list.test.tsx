import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TicketList from "~/components/ticket-list";

describe("TicketList", () => {
  it("shows fallback when empty", () => {
    render(<TicketList title="Oldest open tickets" tickets={[]} emptyMessage="Nothing" />);
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });

  it("renders clickable ticket links", () => {
    render(
      <TicketList
        title="Oldest"
        tickets={[
          {
            id: 8366,
            number: "TCK-8366",
            title: "Printer offline",
            customer: "Acme",
            status: "Open",
            createdAt: "2025-01-01T12:00:00.000Z"
          }
        ]}
      />
    );

    const link = screen.getByRole("link", { name: /8366/i });
    expect(link).toHaveAttribute("href", "https://app.atera.com/new/ticket/8366");
  });
});
