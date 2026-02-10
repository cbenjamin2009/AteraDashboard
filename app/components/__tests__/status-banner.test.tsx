import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusBanner from "~/components/status-banner";

describe("StatusBanner", () => {
  it("renders provided message", () => {
    render(<StatusBanner message="Syncing" variant="warning" />);
    const message = screen.getByText(/syncing/i);
    expect(message).toBeInTheDocument();
    expect(message.closest(".status-banner")).toHaveClass("status-banner--warning");
  });
});
