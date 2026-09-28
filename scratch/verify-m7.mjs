import fs from "fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Load .env
if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const MCP_ENDPOINT = "http://localhost:3000/api/mcp";
const MCP_SECRET = process.env.MCP_TOOL_SECRET;

async function run() {
  console.log("=== MILESTONE 7: BEARER-PROTECTED READ-ONLY MCP SERVER VERIFICATION ===\n");

  if (!MCP_SECRET) {
    throw new Error("MCP_TOOL_SECRET is not configured in .env");
  }

  // 1. Test unauthenticated request (missing header)
  console.log("1. Testing unauthenticated request (missing Authorization)...");
  const resNoAuth = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
  });
  console.log(`✓ Status: ${resNoAuth.status} (expected 401)`);
  const wwwAuthNoAuth = resNoAuth.headers.get("www-authenticate");
  console.log(`✓ WWW-Authenticate header: "${wwwAuthNoAuth}"`);
  if (resNoAuth.status !== 401 || !wwwAuthNoAuth?.includes("Bearer")) {
    throw new Error("Missing auth did not return 401 with WWW-Authenticate: Bearer");
  }

  // 2. Test invalid bearer token
  console.log("\n2. Testing invalid bearer token...");
  const resBadAuth = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer completely-incorrect-secret-value",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 2 }),
  });
  console.log(`✓ Status: ${resBadAuth.status} (expected 401)`);
  if (resBadAuth.status !== 401) {
    throw new Error("Invalid bearer token did not return 401");
  }

  // 3. Connect real MCP Client via StreamableHTTPClientTransport
  console.log("\n3. Connecting real MCP client with correct bearer credentials...");
  const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${MCP_SECRET}`,
      },
    },
  });

  const client = new Client(
    { name: "milestone-7-verifier", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✓ Connected to MCP server over Streamable HTTP transport!");

  // 4. List tools and verify exactly 4 read-only tools
  console.log("\n4. Verifying advertised tools...");
  const toolsList = await client.listTools();
  const toolNames = toolsList.tools.map((t) => t.name).sort();
  console.log(`✓ Advertised tools (${toolNames.length}):`, toolNames);

  const expectedTools = [
    "get_compliance_document",
    "get_compliance_rule",
    "list_compliance_documents",
    "search_compliance_rules",
  ].sort();

  if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
    throw new Error(`Tool mismatch! Expected ${JSON.stringify(expectedTools)}, got ${JSON.stringify(toolNames)}`);
  }

  // 5. Test list_compliance_documents
  console.log("\n5. Testing list_compliance_documents tool...");
  const listDocsRes = await client.callTool({
    name: "list_compliance_documents",
    arguments: { limit: 5 },
  });
  const listDocsData = JSON.parse(listDocsRes.content[0].text);
  console.log(`✓ Retrieved ${listDocsData.documents?.length || 0} documents.`);
  const firstDoc = listDocsData.documents?.[0];
  if (firstDoc) {
    console.log(`   Sample document: "${firstDoc.title}" (${firstDoc.industry})`);
  }

  // 6. Test get_compliance_document (valid + draft/not-found)
  if (firstDoc?._id) {
    console.log("\n6. Testing get_compliance_document with valid ID...");
    const getDocRes = await client.callTool({
      name: "get_compliance_document",
      arguments: { documentId: firstDoc._id },
    });
    const docDetail = JSON.parse(getDocRes.content[0].text);
    console.log(`✓ Document detail retrieved: "${docDetail.document.title}", fileUrl: ${!!docDetail.document.fileUrl}`);
  }

  console.log("   Testing get_compliance_document with unknown ID (expected NOT_FOUND)...");
  const getDocNotFound = await client.callTool({
    name: "get_compliance_document",
    arguments: { documentId: "non-existent-doc-id-999" },
  });
  if (getDocNotFound.isError) {
    const errData = JSON.parse(getDocNotFound.content[0].text);
    console.log(`✓ Error response received as expected: code = ${errData.code}`);
  } else {
    throw new Error("Expected NOT_FOUND error for non-existent document ID");
  }

  console.log("   Testing get_compliance_document with draft ID (expected NOT_FOUND / draft isolation)...");
  const getDocDraft = await client.callTool({
    name: "get_compliance_document",
    arguments: { documentId: `drafts.${firstDoc?._id || "doc-123"}` },
  });
  if (getDocDraft.isError) {
    console.log("✓ Draft ID access blocked with error response (drafts isolated)");
  } else {
    throw new Error("Draft document ID was accessible over MCP!");
  }

  // 7. Find a sample published rule from Sanity to test search and get
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
  const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01";
  const token = process.env.SANITY_API_READ_TOKEN;

  const sanityUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(
    '*[_type == "complianceRule" && !(_id in path("drafts.**"))][0...3]{_id, ruleName, citation, keywords}'
  )}`;
  const sanityRes = await fetch(sanityUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sanityJson = await sanityRes.json();
  const samplePublishedRules = sanityJson.result || [];
  console.log(`\n7. Found ${samplePublishedRules.length} sample published rules in Sanity dataset.`);

  let firstRule = samplePublishedRules[0];
  let searchWord = "compliance";
  if (firstRule?.ruleName) {
    const words = firstRule.ruleName.split(/\s+/).filter((w) => w.length > 3);
    if (words.length > 0) searchWord = words[0];
  }

  // 7. Test search_compliance_rules
  console.log(`\n8. Testing search_compliance_rules tool with query: "${searchWord}"...`);
  const searchRulesRes = await client.callTool({
    name: "search_compliance_rules",
    arguments: { query: searchWord, limit: 5, includeStale: false },
  });
  const searchRulesData = JSON.parse(searchRulesRes.content[0].text);
  console.log(`✓ Retrieved ${searchRulesData.rules?.length || 0} rules for query '${searchWord}'.`);
  if (searchRulesData.rules?.[0]) {
    firstRule = searchRulesData.rules[0];
    console.log(`   Sample rule: "${firstRule.ruleName}" (${firstRule.citation || "No citation"})`);
  }

  // 8. Test get_compliance_rule (valid + draft/not-found)
  if (firstRule?._id) {
    console.log("\n9. Testing get_compliance_rule with valid ID...");
    const getRuleRes = await client.callTool({
      name: "get_compliance_rule",
      arguments: { ruleId: firstRule._id },
    });
    const ruleDetail = JSON.parse(getRuleRes.content[0].text);
    console.log(`✓ Rule detail retrieved: "${ruleDetail.rule.ruleName}"`);
  }

  console.log("   Testing get_compliance_rule with draft ID (expected NOT_FOUND / draft isolation)...");
  const getRuleDraft = await client.callTool({
    name: "get_compliance_rule",
    arguments: { ruleId: `drafts.${firstRule?._id || "rule-123"}` },
  });
  if (getRuleDraft.isError) {
    console.log("✓ Draft rule ID access blocked with error response (drafts isolated)");
  } else {
    throw new Error("Draft rule ID was accessible over MCP!");
  }

  // 9. Source Code Audit: Confirm no write/upload/conversation/AI imports in MCP module
  console.log("\n9. Auditing MCP module imports and dependencies...");
  const mcpRouteContent = fs.readFileSync("src/app/api/mcp/route.ts", "utf8");
  const mcpToolsContent = fs.readFileSync("src/lib/mcp/tools.ts", "utf8");
  const publishedQueriesContent = fs.readFileSync("src/lib/sanity/published-queries.ts", "utf8");

  const forbiddenTerms = [
    "writeClient",
    "createClient",
    "Blob",
    "put(",
    "del(",
    "Firecrawl",
    "GoogleGenerativeAI",
    "streamText",
    "prisma.conversation",
    "prisma.message",
  ];

  for (const term of forbiddenTerms) {
    if (
      mcpRouteContent.includes(term) ||
      mcpToolsContent.includes(term) ||
      publishedQueriesContent.includes(term)
    ) {
      throw new Error(`Forbidden term '${term}' found in MCP code path!`);
    }
  }
  console.log("✓ Capability audit passed: MCP module has 0 write, upload, AI, or conversation dependencies.");

  // Close client connection
  await client.close();
  console.log("\n=== ALL MILESTONE 7 MCP VERIFICATION CHECKS PASSED ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
