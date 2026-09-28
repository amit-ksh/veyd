import assert from "node:assert";
import fs from "node:fs";

async function verifyMilestone8() {
  console.log("=== Verifying Milestone 8: Dashboard UI ===");

  // 1. Check Root Redirect to /chat
  console.log("\n[1] Testing GET / (should redirect to /chat)...");
  const rootRes = await fetch("http://localhost:3000/", { redirect: "manual" });
  console.log("GET / status:", rootRes.status, "location:", rootRes.headers.get("location"));
  assert(
    rootRes.status === 307 || rootRes.status === 308 || rootRes.status === 302,
    `Expected redirect status, got ${rootRes.status}`
  );
  assert(
    rootRes.headers.get("location")?.includes("/chat"),
    `Expected redirect location to include /chat, got ${rootRes.headers.get("location")}`
  );
  console.log("✓ Root redirect to /chat passed.");

  // 2. Check /chat Route Rendering
  console.log("\n[2] Testing GET /chat route rendering...");
  const chatRes = await fetch("http://localhost:3000/chat");
  assert.strictEqual(chatRes.status, 200, `Expected 200, got ${chatRes.status}`);
  const chatHtml = await chatRes.text();
  assert(chatHtml.includes("Veyd"), "Expected HTML to contain Veyd brand");
  console.log("✓ /chat route rendered successfully.");

  // 3. Check /documents Route Rendering
  console.log("\n[3] Testing GET /documents route rendering...");
  const docsRes = await fetch("http://localhost:3000/documents");
  assert.strictEqual(docsRes.status, 200, `Expected 200, got ${docsRes.status}`);
  const docsHtml = await docsRes.text();
  assert(docsHtml.includes("Veyd"), "Expected HTML to contain Veyd brand");
  console.log("✓ /documents route rendered successfully.");

  // 4. Verify CSS Design Tokens & Palette in globals.css
  console.log("\n[4] Verifying CSS Design Tokens & Palette in globals.css...");
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert(css.includes("--ink: #020618;"), "Expected --ink: #020618 in globals.css");
  assert(css.includes("--highlight: #fdfe85;"), "Expected --highlight: #fdfe85 in globals.css");
  assert(css.includes("--surface: #ffffff;"), "Expected --surface: #ffffff in globals.css");
  assert(css.includes("--accent: #00c9d2;"), "Expected --accent: #00c9d2 in globals.css");
  assert(css.includes("prefers-reduced-motion"), "Expected prefers-reduced-motion in globals.css");
  assert(css.includes(":focus-visible"), "Expected :focus-visible focus ring in globals.css");
  console.log("✓ Core design tokens and accessibility styles verified.");

  // 5. Verify AppShell Component Structure
  console.log("\n[5] Verifying AppShell state machines and requirements...");
  const appShell = fs.readFileSync("src/components/app-shell.tsx", "utf8");
  assert(appShell.includes('activeTab === "chat"'), "Expected chat tab handling");
  assert(appShell.includes('activeTab === "documents"'), "Expected documents tab handling");
  assert(appShell.includes("aria-current"), "Expected aria-current accessibility attributes");
  assert(appShell.includes("aria-live="), "Expected live regions for accessibility");
  assert(appShell.includes("role=\"alert\""), "Expected alert roles for error messaging");
  assert(appShell.includes("10 MB"), "Expected 10 MB limit notice");
  assert(appShell.includes("100 pages"), "Expected 100 pages limit notice");
  assert(appShell.includes("upload"), "Expected Blob upload integration");
  assert(appShell.includes("/api/documents/ingest"), "Expected documents ingestion call");
  assert(appShell.includes("extractedRuleCount"), "Expected extracted rule count display");
  assert(appShell.includes("publishedRuleCount"), "Expected published rule count display");
  assert(appShell.includes("Sanity Studio"), "Expected Sanity Studio operator link");
  assert(appShell.includes("Secondary Source Advisory"), "Expected secondary source warning");
  console.log("✓ AppShell state machines, upload integration, and accessibility verified.");

  // 6. Verify No Legacy Navigation
  console.log("\n[6] Verifying no legacy navigation routes...");
  assert(!appShell.includes("/handbook"), "No /handbook navigation link in AppShell");
  assert(!appShell.includes("/workspace/"), "No legacy /workspace navigation link in AppShell");
  assert(!appShell.includes("/verify"), "No legacy /verify navigation link in AppShell");
  console.log("✓ Legacy navigation absence verified.");

  console.log("\n=== ALL MILESTONE 8 CHECKS PASSED SUCCESSFULLY ===");
}

verifyMilestone8().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
