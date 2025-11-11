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
});
