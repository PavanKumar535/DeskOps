
import { test, expect } from "@playwright/test";

test.describe("DeskOps End-to-End Suite: Authentication, Lifecycle, Permissions & Isolation", () => {
  const timestamp = Date.now();
  const ticketTitle = `E2E Live Lifecycle Ticket ${timestamp}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("1. Login, Dashboard & Unauthenticated Access Control", async ({ page }) => {
    await expect(page.locator(".login-card")).toBeVisible();
    await expect(page.locator(".brand-title")).toHaveText("DeskOps");

    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "InvalidPassword999!");
    await page.click("button[type='submit']");
    await expect(page.locator(".alert-error")).toContainText("Invalid email or password");

    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");

    await expect(page.locator(".dashboard-container")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".badge-tenant")).toHaveText("Isolated");
    await expect(page.locator(".user-name")).toContainText("Alice Acme Admin");
    await expect(page.locator(".role-tag")).toContainText("ORG_ADMIN");
    await expect(page.locator(".tickets-section h2")).toContainText("Tenant Maintenance Tickets");

    await page.click(".btn-logout");
    await expect(page.locator(".login-card")).toBeVisible();
  });

  test("2. Ticket Creation through UI", async ({ page }) => {
    await page.fill("#email", "resident@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();

    await page.click(".btn-new-ticket");
    await expect(page.locator(".modal-content")).toBeVisible();
    await expect(page.locator(".modal-header h3")).toHaveText("Raise New Maintenance Ticket");

    await page.fill("#ticket-title", ticketTitle);
    await page.fill(
      "#ticket-description",
      "Automated Playwright E2E verification of maintenance request in cafeteria."
    );
    await page.selectOption("#ticket-priority", "HIGH");
    await page.selectOption("#ticket-category", "Plumbing");

    await page.waitForSelector("#ticket-property option:not([value=''])", { state: "attached" });
    await page.waitForSelector("#ticket-unit option:not([value=''])", { state: "attached" });

    await page.click(".modal-footer .btn-primary");

    await expect(page.locator(".modal-content")).not.toBeVisible();
    await expect(page.locator(".ticket-detail-view")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".ticket-title")).toHaveText(ticketTitle);
    await expect(page.locator(".status-new")).toHaveText("NEW");
    await expect(page.locator(".priority-high")).toHaveText("HIGH");

    await expect(page.locator(".event-badge-created")).toBeVisible();
    await expect(page.locator(".timeline-desc")).toContainText("Ticket created by");
  });

  test("3. Complete Ticket Lifecycle (NEW -> TRIAGED -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> IN_PROGRESS -> RESOLVED -> CLOSED -> REOPENED)", async ({
    page,
  }) => {
    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();

    await page.fill(".search-box input", ticketTitle);
    await page.waitForTimeout(500);

    const ticketRow = page.locator(".tickets-table tbody tr", { hasText: ticketTitle });
    await expect(ticketRow).toBeVisible();
    await ticketRow.click();

    await expect(page.locator(".ticket-detail-view")).toBeVisible();
    await expect(page.locator(".ticket-title")).toHaveText(ticketTitle);

    // NEW -> TRIAGED
    await expect(page.locator(".status-new")).toBeVisible();
    await page.click(".btn-triage");
    await expect(page.locator(".modal-content h3")).toHaveText("Triage Ticket");
    await page.selectOption("#triage-prio", "URGENT");
    await page.fill("#triage-cat", "Critical Plumbing");
    await page.click(".modal-footer .btn-primary");

    await expect(page.locator(".status-triaged")).toHaveText("TRIAGED", { timeout: 10000 });
    await expect(page.locator(".priority-urgent")).toHaveText("URGENT");
    await expect(page.locator(".event-badge-triaged")).toBeVisible();

    // TRIAGED -> ASSIGNED
    await page.click(".btn-assign");
    await expect(page.locator(".modal-content h3")).toHaveText("Assign Technician to Ticket");
    await page.waitForSelector("#technician-select option", { state: "attached" });
    await page.click(".modal-footer .btn-primary");

    await expect(page.locator(".status-assigned")).toHaveText("ASSIGNED", { timeout: 10000 });
    await expect(page.locator(".text-tech-name")).toBeVisible();
    await expect(page.locator(".event-badge-assigned")).toBeVisible();

    // ASSIGNED -> IN_PROGRESS
    await page.click(".btn-progress");
    await expect(page.locator(".status-in_progress")).toHaveText("IN_PROGRESS", { timeout: 10000 });

    // IN_PROGRESS -> ON_HOLD
    await page.click(".btn-hold");
    await expect(page.locator(".status-on_hold")).toHaveText("ON_HOLD", { timeout: 10000 });
    await expect(page.locator(".btn-progress")).toHaveText("Resume Work");

    // ON_HOLD -> IN_PROGRESS
    await page.click(".btn-progress");
    await expect(page.locator(".status-in_progress")).toHaveText("IN_PROGRESS", { timeout: 10000 });

    // IN_PROGRESS -> RESOLVED
    await page.click(".btn-resolve");
    await expect(page.locator(".modal-content h3")).toHaveText("Resolve Maintenance Ticket");
    await page.fill(
      "#resolution-notes",
      "Replaced corroded cafeteria pipe fitting and tested water pressure under load."
    );
    await page.click(".modal-footer .btn-primary");

    await expect(page.locator(".status-resolved")).toHaveText("RESOLVED", { timeout: 10000 });
    await expect(page.locator(".window-active")).toContainText("ACTIVE");
    await expect(page.locator(".event-badge-resolved")).toBeVisible();

    // RESOLVED -> CLOSED
    page.on("dialog", (dialog) => dialog.accept());
    await page.click(".btn-close");
    await expect(page.locator(".status-closed")).toHaveText("CLOSED", { timeout: 10000 });
    await expect(page.locator(".event-badge-closed")).toBeVisible();

    // CLOSED -> REOPENED
    await expect(page.locator(".btn-reopen")).toBeVisible();
    await page.click(".btn-reopen");
    await expect(page.locator(".modal-content h3")).toHaveText("Reopen Closed Ticket");
    await page.fill(
      "#reopen-reason",
      "Secondary fitting started minor weeping after thermal cycle."
    );
    await page.click(".modal-footer .btn-primary");

    await expect(page.locator(".status-reopened")).toHaveText("REOPENED", { timeout: 10000 });
    await expect(page.locator(".event-badge-reopened")).toBeVisible();

    // Verify all 9 audit timeline events
    const timelineItems = page.locator(".timeline-item");

    await expect(timelineItems).toHaveCount(9);

    for (let i = 0; i < 9; i++) {
      const item = timelineItems.nth(i);

      // Verify event timestamp
      const eventTimestamp = item.locator(".timeline-time");
      await expect(eventTimestamp).toBeVisible();
      await expect(eventTimestamp).not.toBeEmpty();

      // Verify event actor
      const eventActor = item.locator(".actor-name");
      await expect(eventActor).toBeVisible();
      await expect(eventActor).not.toBeEmpty();
    }

    await page.click(".btn-back");
    await expect(page.locator(".tickets-section")).toBeVisible();
  });

  test("4. Role-Based Permissions & Store Boundaries", async ({ page }) => {
    await page.fill("#email", "manager@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();
    await expect(page.locator(".role-tag")).toContainText("STAFF");

    const storeTexts = await page.locator(".tickets-table tbody tr").allTextContents();

    for (const text of storeTexts) {
      if (text.includes("Unit")) {
        expect(text).toContain("Acme Tower");
      }
    }
  });

  test("5. Multi-Tenant Security & Cross-Tenant Rejection in UI", async ({ page }) => {
    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();

    await page.click("button:has-text('Test Cross-Tenant Protection')");

    await expect(page.locator(".alert-success")).toContainText("Security Check Passed");
    await expect(page.locator(".alert-success")).toContainText(
      "Backend securely blocked foreign/invalid resource"
    );

    await page.click(".btn-logout");
    await page.fill("#email", "admin@apex.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");

    await expect(page.locator(".meta-value:has-text('Apex Property Holdings')")).toBeVisible();
    await expect(page.locator(".dashboard-container")).not.toContainText("Acme Facilities");
  });
});
