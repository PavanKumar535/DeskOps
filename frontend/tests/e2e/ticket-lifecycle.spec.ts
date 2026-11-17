import { test, expect } from "@playwright/test";

test.describe("DeskOps End-to-End Suite: Authentication, Lifecycle, Permissions & Isolation", () => {
  const timestamp = Date.now();
  const ticketTitle = `E2E Live Lifecycle Ticket ${timestamp}`;

  test.beforeEach(async ({ page }) => {
    // Navigate to root
    await page.goto("/");
  });

  test("1. Login, Dashboard & Unauthenticated Access Control", async ({ page }) => {
    // Check initial login state
    await expect(page.locator(".login-card")).toBeVisible();
    await expect(page.locator(".brand-title")).toHaveText("DeskOps");

    // Verify invalid login failure
    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "InvalidPassword999!");
    await page.click("button[type='submit']");
    await expect(page.locator(".alert-error")).toContainText("Invalid email or password");

    // Log in with valid Org A Admin credentials
    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");

    // Verify dashboard elements
    await expect(page.locator(".dashboard-container")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".badge-tenant")).toHaveText("Isolated");
    await expect(page.locator(".user-name")).toContainText("Alice Acme Admin");
    await expect(page.locator(".role-tag")).toContainText("ORG_ADMIN");
    await expect(page.locator(".tickets-section h2")).toContainText("Tenant Maintenance Tickets");

    // Logout
    await page.click(".btn-logout");
    await expect(page.locator(".login-card")).toBeVisible();
  });

  test("2. Ticket Creation through UI", async ({ page }) => {
    // Log in as Org A Resident
    await page.fill("#email", "resident@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();

    // Click "+ Raise New Ticket"
    await page.click(".btn-new-ticket");
    await expect(page.locator(".modal-content")).toBeVisible();
    await expect(page.locator(".modal-header h3")).toHaveText("Raise New Maintenance Ticket");

    // Fill form
    await page.fill("#ticket-title", ticketTitle);
    await page.fill(
      "#ticket-description",
      "Automated Playwright E2E verification of maintenance request in cafeteria."
    );
    await page.selectOption("#ticket-priority", "HIGH");
    await page.selectOption("#ticket-category", "Plumbing");

    // Wait for properties and units dropdown to be loaded and populated
    await page.waitForSelector("#ticket-property option:not([value=''])", { state: "attached" });
    await page.waitForSelector("#ticket-unit option:not([value=''])", { state: "attached" });

    // Submit form
    await page.click(".modal-footer .btn-primary");

    // Modal closes and detail card opens
    await expect(page.locator(".modal-content")).not.toBeVisible();
    await expect(page.locator(".ticket-detail-view")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".ticket-title")).toHaveText(ticketTitle);
    await expect(page.locator(".status-new")).toHaveText("NEW");
    await expect(page.locator(".priority-high")).toHaveText("HIGH");

    // Verify creation event in timeline
    await expect(page.locator(".event-badge-created")).toBeVisible();
    await expect(page.locator(".timeline-desc")).toContainText("Ticket created by");
  });

  test("3. Complete Ticket Lifecycle (NEW -> TRIAGED -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> IN_PROGRESS -> RESOLVED -> CLOSED -> REOPENED)", async ({
    page,
  }) => {
    // Step 0: Login as Admin to manage the ticket through full lifecycle
    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();

    // Find the ticket created in previous test
    await page.fill(".search-box input", ticketTitle);
    await page.waitForTimeout(500);
    const ticketRow = page.locator(".tickets-table tbody tr", { hasText: ticketTitle });
    await expect(ticketRow).toBeVisible();
    await ticketRow.click();

    // Wait for detail view
    await expect(page.locator(".ticket-detail-view")).toBeVisible();
    await expect(page.locator(".ticket-title")).toHaveText(ticketTitle);

    // --- Transition 1: NEW -> TRIAGED ---
    await expect(page.locator(".status-new")).toBeVisible();
    await page.click(".btn-triage");
    await expect(page.locator(".modal-content h3")).toHaveText("Triage Ticket");
    await page.selectOption("#triage-prio", "URGENT");
    await page.fill("#triage-cat", "Critical Plumbing");
    await page.click(".modal-footer .btn-primary");

    // Verify TRIAGED state
    await expect(page.locator(".status-triaged")).toHaveText("TRIAGED", { timeout: 10000 });
    await expect(page.locator(".priority-urgent")).toHaveText("URGENT");
    await expect(page.locator(".event-badge-triaged")).toBeVisible();

    // --- Transition 2: TRIAGED -> ASSIGNED ---
    await page.click(".btn-assign");
    await expect(page.locator(".modal-content h3")).toHaveText("Assign Technician to Ticket");
    await page.waitForSelector("#technician-select option", { state: "attached" });
    await page.click(".modal-footer .btn-primary");

    // Verify ASSIGNED state
    await expect(page.locator(".status-assigned")).toHaveText("ASSIGNED", { timeout: 10000 });
    await expect(page.locator(".text-tech-name")).toBeVisible();
    await expect(page.locator(".event-badge-assigned")).toBeVisible();

    // --- Transition 3: ASSIGNED -> IN_PROGRESS ---
    await page.click(".btn-progress");
    await expect(page.locator(".status-in_progress")).toHaveText("IN_PROGRESS", { timeout: 10000 });

    // --- Transition 4: IN_PROGRESS -> ON_HOLD ---
    await page.click(".btn-hold");
    await expect(page.locator(".status-on_hold")).toHaveText("ON_HOLD", { timeout: 10000 });
    await expect(page.locator(".btn-progress")).toHaveText("Resume Work");

    // --- Transition 5: ON_HOLD -> IN_PROGRESS (Resume) ---
    await page.click(".btn-progress");
    await expect(page.locator(".status-in_progress")).toHaveText("IN_PROGRESS", { timeout: 10000 });

    // --- Transition 6: IN_PROGRESS -> RESOLVED ---
    await page.click(".btn-resolve");
    await expect(page.locator(".modal-content h3")).toHaveText("Resolve Maintenance Ticket");
    await page.fill(
      "#resolution-notes",
      "Replaced corroded cafeteria pipe fitting and tested water pressure under load."
    );
    await page.click(".modal-footer .btn-primary");

    // Verify RESOLVED state and active reopen window
    await expect(page.locator(".status-resolved")).toHaveText("RESOLVED", { timeout: 10000 });
    await expect(page.locator(".window-active")).toContainText("ACTIVE");
    await expect(page.locator(".event-badge-resolved")).toBeVisible();

    // --- Transition 7: RESOLVED -> CLOSED ---
    page.on("dialog", (dialog) => dialog.accept());
    await page.click(".btn-close");
    await expect(page.locator(".status-closed")).toHaveText("CLOSED", { timeout: 10000 });
    await expect(page.locator(".event-badge-closed")).toBeVisible();

    // --- Transition 8: CLOSED -> REOPENED (Within Active Window) ---
    await expect(page.locator(".btn-reopen")).toBeVisible();
    await page.click(".btn-reopen");
    await expect(page.locator(".modal-content h3")).toHaveText("Reopen Closed Ticket");
    await page.fill(
      "#reopen-reason",
      "Secondary fitting started minor weeping after thermal cycle."
    );
    await page.click(".modal-footer .btn-primary");

    // Verify REOPENED state
    await expect(page.locator(".status-reopened")).toHaveText("REOPENED", { timeout: 10000 });
    await expect(page.locator(".event-badge-reopened")).toBeVisible();

    // Return to list
    await page.click(".btn-back");
    await expect(page.locator(".tickets-section")).toBeVisible();
  });

  test("4. Role-Based Permissions & Store Boundaries", async ({ page }) => {
    // Log in as Store Manager (STAFF)
    await page.fill("#email", "manager@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();
    await expect(page.locator(".role-tag")).toContainText("STAFF");

    // Verify tickets displayed belong to Store 1 (Acme Tower)
    const storeTexts = await page.locator(".tickets-table tbody tr").allTextContents();
    for (const text of storeTexts) {
      if (text.includes("Unit")) {
        expect(text).toContain("Acme Tower");
      }
    }
  });

  test("5. Multi-Tenant Security & Cross-Tenant Rejection in UI", async ({ page }) => {
    // Log in as Org A Admin
    await page.fill("#email", "admin@acme.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");
    await expect(page.locator(".dashboard-container")).toBeVisible();

    // Click "Test Cross-Tenant Protection" button
    await page.click("button:has-text('Test Cross-Tenant Protection')");

    // Verify security pass alert
    await expect(page.locator(".alert-success")).toContainText("Security Check Passed");
    await expect(page.locator(".alert-success")).toContainText("Backend securely blocked foreign/invalid resource");

    // Log out and log in as Org B Admin
    await page.click(".btn-logout");
    await page.fill("#email", "admin@apex.com");
    await page.fill("#password", "Password123!");
    await page.click("button[type='submit']");

    // Verify Org B tenant context
    await expect(page.locator(".meta-value:has-text('Apex Property Holdings')")).toBeVisible();
    await expect(page.locator(".dashboard-container")).not.toContainText("Acme Facilities");
  });
});
