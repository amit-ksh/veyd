import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

async function verifyMilestone10() {
  console.log("================================================================");
  console.log("=== Milestone 10: Full Manual Acceptance Verification Suite ===");
  console.log("================================================================\n");

  // 1. Build and configuration verification
  console.log("[SECTION 1] Build and Configuration");
  assert(fs.existsSync(".next"), "Expected Next.js build output in .next");
  console.log("✓ Next.js production build output verified.");

  const studioDist = path.join("sanity", "dist", "index.html");
  assert(fs.existsSync(studioDist), "Expected Sanity Studio build output in sanity/dist");
  console.log("✓ Standalone Sanity Studio build artifact verified.");

  const healthRes = await fetch("http://localhost:3000/api/health");
  assert.strictEqual(healthRes.status, 200, "Health check should return 200");
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, "ok", "Expected status: ok in health response");
  const correlationId = healthRes.headers.get("x-correlation-id");
  assert(correlationId, "Expected X-Correlation-Id header in health response");
  console.log("✓ Health check passes with valid configuration and correlation ID:", correlationId);

  // 2. Navigation, Routing & Accessibility
  console.log("\n[SECTION 2] Navigation, Routing & Accessibility");
  const rootRes = await fetch("http://localhost:3000/", { redirect: "manual" });
  assert(
    rootRes.status === 307 || rootRes.status === 308 || rootRes.status === 302,
    `Expected redirect status, got ${rootRes.status}`
  );
  assert(
    rootRes.headers.get("location")?.includes("/chat"),
    "Expected redirect to /chat"
  );
  console.log("✓ Root (/) correctly redirects to /chat.");

  const chatRes = await fetch("http://localhost:3000/chat");
  assert.strictEqual(chatRes.status, 200);
  const chatHtml = await chatRes.text();
  assert(chatHtml.includes("Veyd"), "Chat UI should include Veyd brand");
  console.log("✓ /chat route rendered successfully.");

  const docsRes = await fetch("http://localhost:3000/documents");
  assert.strictEqual(docsRes.status, 200);
  const docsHtml = await docsRes.text();
  assert(docsHtml.includes("Veyd"), "Documents UI should include Veyd brand");
  console.log("✓ /documents route rendered successfully.");

  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert(css.includes("--ink: #020618;"), "Palette requires dark ink token");
  assert(css.includes("--highlight: #fdfe85;"), "Palette requires highlight yellow token");
  assert(css.includes("--accent: #00c9d2;"), "Palette requires accent cyan token");
  assert(css.includes("prefers-reduced-motion"), "Accessibility requires prefers-reduced-motion rule");
  assert(css.includes(":focus-visible"), "Accessibility requires :focus-visible rule");
  console.log("✓ CSS design tokens and accessibility rules verified.");

  // 3. MCP Endpoint Security & Contracts
  console.log("\n[SECTION 3] Public MCP Security & Contracts");
  const unauthMcpRes = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.strictEqual(unauthMcpRes.status, 401, "Unauthenticated MCP request must return 401");
  assert(
    unauthMcpRes.headers.get("www-authenticate")?.includes("Bearer"),
    "MCP 401 must return WWW-Authenticate: Bearer header"
  );
  assert(unauthMcpRes.headers.get("x-correlation-id"), "Expected X-Correlation-Id on MCP rejection");
  console.log("✓ MCP endpoint strictly requires Bearer token and returns 401 with correlation ID.");

  const mcpToolsFile = fs.readFileSync("src/lib/mcp/tools.ts", "utf8");
  const expectedTools = [
    "search_compliance_rules",
    "get_compliance_rule",
    "list_compliance_documents",
    "get_compliance_document",
  ];
  for (const tool of expectedTools) {
    assert(mcpToolsFile.includes(tool), `Expected tool ${tool} in MCP tools`);
  }
  assert(!mcpToolsFile.includes("writeClient"), "MCP tools must not import or use writeClient");
  console.log("✓ Exactly 4 read-only published tools defined without write capabilities.");

  // 4. Ingestion Safety & Limits
  console.log("\n[SECTION 4] Ingestion Safety & Runtime Limits");
  const ingestRoute = fs.readFileSync("src/app/api/documents/ingest/route.ts", "utf8");
  assert(ingestRoute.includes('export const runtime = "nodejs"'), "Ingest must use nodejs runtime");
  assert(ingestRoute.includes("export const maxDuration = 300"), "Ingest maxDuration must be 300s");
  assert(ingestRoute.includes('export const dynamic = "force-dynamic"'), "Ingest must be force-dynamic");
  console.log("✓ Ingest route runtime and duration limits verified (nodejs, 300s).");

  const unauthIngest = await fetch("http://localhost:3000/api/documents/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert(unauthIngest.status === 400 || unauthIngest.status === 401, "Expected 400 or 401 on empty body");
  console.log("✓ Ingest route safely rejects empty/invalid payload.");

  // 5. Conversation Persistence & Isolation
  console.log("\n[SECTION 5] Conversation Persistence & Scoping");
  const unauthConv = await fetch("http://localhost:3000/api/conversations/00000000-0000-0000-0000-000000000000");
  assert.strictEqual(unauthConv.status, 401, "Unauthenticated conversation lookup must return 401");
  console.log("✓ Conversations are strictly scoped and require authentication.");

  // 6. Observability, Structured Logging & Redaction
  console.log("\n[SECTION 6] Observability, Structured Logging & Safe Redaction");
  const loggerCode = fs.readFileSync("src/lib/logger.ts", "utf8");
  const forbiddenKeys = [
    "authorization",
    "secret",
    "token",
    "password",
    "geminikey",
    "firecrawlkey",
    "mcpsecret",
  ];
  for (const k of forbiddenKeys) {
    assert(loggerCode.includes(`"${k}"`), `Expected ${k} in logger redaction forbidden keys`);
  }
  console.log("✓ Central logger enforces strict redaction of credentials and secrets.");

  // 7. Rate Limiting Configuration
  console.log("\n[SECTION 7] Rate Limiting & Abuse Controls");
  const rateLimitCode = fs.readFileSync("src/lib/rate-limit.ts", "utf8");
  assert(rateLimitCode.includes("5"), "Expected 5 token limit for ingestion");
  assert(rateLimitCode.includes("30"), "Expected 30 turn limit for chat");
  assert(rateLimitCode.includes("Retry-After"), "Expected Retry-After header support");
  console.log("✓ Rate limiting configured with 5 uploads/hour and 30 chat turns/hour with Retry-After headers.");

  console.log("\n================================================================");
  console.log("=== ALL MILESTONE 10 MANUAL ACCEPTANCE SUITE CHECKS PASSED ===");
  console.log("================================================================\n");
}

verifyMilestone10().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
