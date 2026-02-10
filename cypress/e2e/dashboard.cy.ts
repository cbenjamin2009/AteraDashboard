describe("Dashboard", () => {
  it("shows mocked metrics", () => {
    cy.visit("/");

    cy.contains("Atera Operations Dashboard").should("be.visible");
    cy.contains("Open Tickets").parent().should("contain.text", "12");
    cy.contains("Pending Tickets").parent().should("contain.text", "2");

    cy.contains("tickets.ticket_id");
    cy.get('a[href="https://app.atera.com/new/ticket/8366"]').should("exist");

    cy.contains("Technician workload").should("be.visible");
    cy.contains("Critical alerts").should("be.visible");
  });

  it("navigates to monthly review and back", () => {
    cy.visit("/");

    cy.contains("Monthly Review").click();
    cy.url().should("include", "/monthly-review");
    cy.contains("Monthly Review").should("be.visible");
    cy.contains("Total Tickets").parent().should("contain.text", "January 2025");
    cy.contains("Tickets for January 2025").should("be.visible");
    cy.contains("Page").should("contain.text", "/");
    cy.contains("Refresh data").click();
    cy.url().should("include", "refresh=1");

    cy.contains("Live Dashboard").click();
    cy.url().should("match", /\/$/);
    cy.contains("Atera Operations Dashboard").should("be.visible");
  });
});
