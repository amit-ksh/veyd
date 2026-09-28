import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

async function verifyMilestone9() {
  console.log("=== Verifying Milestone 9: Deployment and Operations ===");

  // 1. Health check & Correlation ID generation
  console.log("\n[1] Testing GET /api/health (automatic correlation ID generation)...");
  const healthRes = await fetch("http://localhost:3000/api/health");
  assert.strictEqual(healthRes.status, 200, `Expected 200, got ${healthRes.status}`);
  const correlationId = healthRes.headers.get("x-correlation-id");
  assert(correlationId, "Expected X-Correlation-Id header in response");
  console.log("✓ Server automatically generated X-Correlation-Id:", correlationId);

  // 2. Health check & Custom Correlation ID propagation
  console.log("\n[2] Testing GET /api/health (preserving incoming correlation ID)...");
  const testId = "test-corr-id-999-prod-check";
  const customRes = await fetch("http://localhost:3000/api/health", {
    headers: { "x-correlation-id": testId },
  });
  assert.strictEqual(customRes.status, 200);
  assert.strictEqual(
    customRes.headers.get("x-correlation-id"),
    testId,
    `Expected X-Correlation-Id to match incoming header`
  );
  console.log("✓ Incoming X-Correlation-Id roundtripped successfully:", testId);

  // 3. MCP Route Error & Correlation ID propagation
  console.log("\n[3] Testing POST /api/mcp authentication failure response & correlation ID...");
  const mcpTestId = "mcp-unauth-test-corr-456";
  const mcpRes = await fetch("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-correlation-id": mcpTestId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.strictEqual(mcpRes.status, 401, `Expected 401 Unauthorized, got ${mcpRes.status}`);
  assert(
    mcpRes.headers.get("www-authenticate")?.includes("Bearer"),
    "Expected WWW-Authenticate header with Bearer"
  );
  assert.strictEqual(
    mcpRes.headers.get("x-correlation-id"),
    mcpTestId,
    "Expected MCP error response to include X-Correlation-Id"
  );
  console.log("✓ MCP authentication failure properly handled with 401, WWW-Authenticate, and correlation ID");

  // 4. Verify Route Runtime & Duration Configurations
  console.log("\n[4] Verifying route runtime and maxDuration configurations...");
  const routesToCheck = [
    {
      file: "src/app/api/documents/ingest/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const maxDuration = 300',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/chat/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const maxDuration = 60',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/mcp/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const maxDuration = 30',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/blob/upload/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/documents/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/documents/[documentId]/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/conversations/[conversationId]/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const dynamic = "force-dynamic"',
      ],
    },
    {
      file: "src/app/api/health/route.ts",
      expected: [
        'export const runtime = "nodejs"',
        'export const dynamic = "force-dynamic"',
      ],
    },
  ];

  for (const { file, expected } of routesToCheck) {
    const content = fs.readFileSync(file, "utf8");
    for (const exp of expected) {
      assert(content.includes(exp), `Expected ${file} to contain: ${exp}`);
    }
    console.log(`✓ ${file} configured correctly: ${expected.join(", ")}`);
  }

  // 5. Verify Logger Implementation & Redaction
  console.log("\n[5] Verifying structured logger and safe redaction...");
  const loggerCode = fs.readFileSync("src/lib/logger.ts", "utf8");
  assert(loggerCode.includes("FORBIDDEN_LOG_KEYS"), "Expected FORBIDDEN_LOG_KEYS list");
  assert(loggerCode.includes("getOrCreateCorrelationId"), "Expected getOrCreateCorrelationId");
  assert(loggerCode.includes("REDACTED_BEARER"), "Expected Bearer token redaction");
  assert(loggerCode.includes("timed<T>"), "Expected async timed helper");
  console.log("✓ Logger contains redaction, correlation, and timing helpers.");

  // 6. Verify Temporary Blob Locator Logging
  console.log("\n[6] Verifying temporary Blob cleanup logging with locator...");
  const ingestionServiceCode = fs.readFileSync("src/lib/ingestion/service.ts", "utf8");
  assert(
    ingestionServiceCode.includes("temporary_blob_delete_failed"),
    "Expected temporary_blob_delete_failed log event in ingestion service"
  );
  assert(
    ingestionServiceCode.includes("blobUrl"),
    "Expected blobUrl locator in temporary blob failure log"
  );
  console.log("✓ Ingestion service logs temporary Blob deletion failures with blobUrl locator.");

  // 7. Verify Sanity Studio standalone build output
  console.log("\n[7] Verifying Sanity Studio build output...");
  const studioDistHtml = path.join("sanity", "dist", "index.html");
  assert(fs.existsSync(studioDistHtml), `Expected Sanity Studio build output at ${studioDistHtml}`);
  const studioIndexContent = fs.readFileSync(studioDistHtml, "utf8");
  assert(studioIndexContent.includes("Sanity Studio"), "Expected Sanity Studio HTML title/content");
  console.log("✓ Sanity Studio standalone build artifact verified at sanity/dist/index.html");

  // 8. Verify .env.example
  console.log("\n[8] Verifying .env.example template completeness...");
  const envExample = fs.readFileSync(".env.example", "utf8");
  const requiredEnvVars = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
    "NEXT_PUBLIC_SANITY_DATASET",
    "NEXT_PUBLIC_SANITY_API_VERSION",
    "SANITY_STUDIO_PROJECT_ID",
    "SANITY_STUDIO_DATASET",
    "SANITY_API_READ_TOKEN",
    "SANITY_API_WRITE_TOKEN",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_MODEL",
    "FIRECRAWL_API_KEY",
    "BLOB_READ_WRITE_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "MCP_TOOL_SECRET",
  ];
  for (const v of requiredEnvVars) {
    assert(envExample.includes(v), `Expected .env.example to include ${v}`);
  }
  assert(!envExample.includes("sk-"), "Never commit real secret prefixes in .env.example");
  console.log("✓ .env.example contains all required environment variables with safe placeholders.");

  console.log("\n=== ALL MILESTONE 9 CHECKS PASSED SUCCESSFULLY ===");
}

verifyMilestone9().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
