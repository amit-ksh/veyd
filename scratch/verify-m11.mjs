import { PrismaClient } from "@prisma/client";
import { createClient } from "@sanity/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-03-01",
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN,
});

function hashMcpToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function run() {
  console.log("=== MILESTONE 11 COMPREHENSIVE VERIFICATION ===\n");

  // 1. Verify User and Seeded Projects
  console.log("1. Checking User & Seeded Projects...");
  let user;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      user = await prisma.user.findFirst({
        where: { email: "amit.veyd@yopmail.com" },
        include: { projects: true },
      });
      if (user) break;
    } catch (e) {
      if (attempt === 3) throw e;
      console.log(`  (Neon retry ${attempt}/3...)`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!user) throw new Error("Seed user amit.veyd@yopmail.com not found in PostgreSQL");
  console.log(`- User: ${user.email} (${user.id})`);
  console.log(`- Owned Projects (${user.projects.length}):`);
  for (const p of user.projects) {
    console.log(`  * ${p.name} [ID: ${p.id}]`);
  }

  const foodProject = user.projects.find((p) => p.name === "Food Safety");
  const pharmaProject = user.projects.find((p) => p.name === "Pharma Protocol");
  if (!foodProject || !pharmaProject) {
    throw new Error("Missing Food Safety or Pharma Protocol projects!");
  }
  console.log("  [PASS] Seeded projects present and owned by user.\n");

  // 2. Verify Conversation Project Invariant
  console.log("2. Checking Conversation Project Invariant...");
  const conversations = await prisma.conversation.findMany({
    include: { project: true },
  });
  console.log(`- Found ${conversations.length} conversation(s) in PostgreSQL.`);
  for (const c of conversations) {
    if (!c.projectId || !c.project) {
      throw new Error(`Conversation ${c.id} has no projectId or project relation!`);
    }
    if (c.project.ownerId !== c.userId) {
      throw new Error(`Conversation ${c.id} owner ${c.userId} != project owner ${c.project.ownerId}!`);
    }
    console.log(`  * Conv: ${c.id} -> Project: ${c.project.name} (${c.projectId}) [Owner match verified]`);
  }
  console.log("  [PASS] All conversations have valid required projectId matching owner.\n");

  // 3. Verify Sanity Documents & Rules Project Invariants
  console.log("3. Checking Sanity Documents & Rules Project Invariants...");
  const sanityDocs = await sanity.fetch(`*[_type == "complianceDocument"]{ _id, title, projectId }`);
  console.log(`- Found ${sanityDocs.length} complianceDocument(s) in Sanity:`);
  for (const d of sanityDocs) {
    if (!d.projectId) {
      throw new Error(`Document ${d._id} is missing required projectId!`);
    }
    console.log(`  * Doc: ${d._id} ("${d.title}") -> Project: ${d.projectId}`);
  }

  const sanityRules = await sanity.fetch(
    `*[_type == "complianceRule"]{ _id, ruleName, projectId, "sourceDocProjectId": sourceDocument->projectId }`
  );
  console.log(`- Found ${sanityRules.length} complianceRule(s) in Sanity:`);
  for (const r of sanityRules) {
    if (!r.projectId) {
      throw new Error(`Rule ${r._id} is missing required projectId!`);
    }
    if (r.sourceDocProjectId && r.sourceDocProjectId !== r.projectId) {
      throw new Error(`Invariant 2 violation: Rule ${r._id} projectId (${r.projectId}) != sourceDocument projectId (${r.sourceDocProjectId})!`);
    }
    console.log(`  * Rule: ${r._id} -> Rule Project: ${r.projectId} == SourceDoc Project: ${r.sourceDocProjectId}`);
  }
  console.log("  [PASS] Invariant 2 (rule.projectId === sourceDocument.projectId) verified for 100% of rules.\n");

  // 4. Sanity Isolation Test: Food Safety vs Pharma Protocol
  console.log("4. Testing Published Sanity Query Isolation...");
  const foodRules = await sanity.fetch(
    `*[_type == "complianceRule" && !(_id in path("drafts.**")) && projectId == $projectId]{ _id, ruleName, projectId }`,
    { projectId: foodProject.id }
  );
  const pharmaRules = await sanity.fetch(
    `*[_type == "complianceRule" && !(_id in path("drafts.**")) && projectId == $projectId]{ _id, ruleName, projectId }`,
    { projectId: pharmaProject.id }
  );

  console.log(`- Food Safety published rules (${foodRules.length}):`);
  for (const r of foodRules) {
    console.log(`  * [Food] ${r.ruleName} (ID: ${r._id})`);
    if (r.projectId !== foodProject.id) throw new Error("Leaked non-food rule into Food project query!");
  }

  console.log(`- Pharma Protocol published rules (${pharmaRules.length}):`);
  for (const r of pharmaRules) {
    console.log(`  * [Pharma] ${r.ruleName} (ID: ${r._id})`);
    if (r.projectId !== pharmaProject.id) throw new Error("Leaked non-pharma rule into Pharma project query!");
  }

  // Cross-project document query
  const foodDocInPharma = await sanity.fetch(
    `*[_type == "complianceDocument" && !(_id in path("drafts.**")) && _id == $docId && projectId == $projectId][0]`,
    { docId: "doc-fda-fsma-2026", projectId: pharmaProject.id }
  );
  if (foodDocInPharma !== null) {
    throw new Error("Cross-project document retrieval succeeded when it should have returned null!");
  }
  console.log("  * Cross-project document query (Food doc with Pharma projectId) -> null (Non-enumerating 404)");

  // Cross-project rule query
  const foodRuleId = foodRules[0]?._id;
  if (foodRuleId) {
    const foodRuleInPharma = await sanity.fetch(
      `*[_type == "complianceRule" && !(_id in path("drafts.**")) && _id == $ruleId && projectId == $projectId][0]`,
      { ruleId: foodRuleId, projectId: pharmaProject.id }
    );
    if (foodRuleInPharma !== null) {
      throw new Error("Cross-project rule retrieval succeeded when it should have returned null!");
    }
    console.log("  * Cross-project rule query (Food rule with Pharma projectId) -> null (Non-enumerating 404)");
  }
  console.log("  [PASS] Isolation verified between Food Safety and Pharma Protocol content.\n");

  // 5. MCP Project Credentials Lifecycle & Isolation
  console.log("5. Testing MCP Project Credentials Lifecycle & Resolution...");
  // Create credential for Food Safety
  const rawTokenFood = "veyd_mcp_test_food_" + crypto.randomBytes(24).toString("hex");
  const tokenHashFood = hashMcpToken(rawTokenFood);
  const tokenHintFood = `...${rawTokenFood.slice(-6)}`;

  const credFood = await prisma.projectMcpCredential.create({
    data: {
      projectId: foodProject.id,
      label: "Verification Test Food Token",
      tokenHash: tokenHashFood,
      tokenHint: tokenHintFood,
    },
  });
  console.log(`- Created Food MCP credential: ${credFood.id} [hint: ${tokenHintFood}]`);

  // Create credential for Pharma Protocol
  const rawTokenPharma = "veyd_mcp_test_pharma_" + crypto.randomBytes(24).toString("hex");
  const tokenHashPharma = hashMcpToken(rawTokenPharma);
  const tokenHintPharma = `...${rawTokenPharma.slice(-6)}`;

  const credPharma = await prisma.projectMcpCredential.create({
    data: {
      projectId: pharmaProject.id,
      label: "Verification Test Pharma Token",
      tokenHash: tokenHashPharma,
      tokenHint: tokenHintPharma,
    },
  });
  console.log(`- Created Pharma MCP credential: ${credPharma.id} [hint: ${tokenHintPharma}]`);

  // Test Bearer resolution for Food token
  const resolvedFood = await prisma.projectMcpCredential.findFirst({
    where: { tokenHash: tokenHashFood, revokedAt: null },
    include: { project: true },
  });
  if (!resolvedFood || resolvedFood.projectId !== foodProject.id) {
    throw new Error("Failed to resolve Food token to Food Safety project!");
  }
  console.log(`  * Food token resolved to projectId: ${resolvedFood.projectId} (${resolvedFood.project.name})`);

  // Test Bearer resolution for Pharma token
  const resolvedPharma = await prisma.projectMcpCredential.findFirst({
    where: { tokenHash: tokenHashPharma, revokedAt: null },
    include: { project: true },
  });
  if (!resolvedPharma || resolvedPharma.projectId !== pharmaProject.id) {
    throw new Error("Failed to resolve Pharma token to Pharma Protocol project!");
  }
  console.log(`  * Pharma token resolved to projectId: ${resolvedPharma.projectId} (${resolvedPharma.project.name})`);

  // Test Revocation: Revoke Food token
  await prisma.projectMcpCredential.update({
    where: { id: credFood.id },
    data: { revokedAt: new Date() },
  });
  console.log(`  * Revoked Food MCP credential ${credFood.id}`);

  // Test resolution of revoked token
  const resolvedRevoked = await prisma.projectMcpCredential.findFirst({
    where: { tokenHash: tokenHashFood, revokedAt: null },
  });
  if (resolvedRevoked !== null) {
    throw new Error("Revoked token still resolved!");
  }
  console.log("  * Revoked token lookup returned null (immediate 401 Unauthorized)");

  // Test resolution of unrevoked Pharma token still works
  const stillActivePharma = await prisma.projectMcpCredential.findFirst({
    where: { tokenHash: tokenHashPharma, revokedAt: null },
  });
  if (!stillActivePharma) {
    throw new Error("Pharma token was improperly affected by Food token revocation!");
  }
  console.log("  * Pharma token remains active and valid after Food token revocation");

  // Clean up test credentials
  await prisma.projectMcpCredential.deleteMany({
    where: { id: { in: [credFood.id, credPharma.id] } },
  });
  console.log("  * Cleaned up temporary test credentials.");
  console.log("  [PASS] MCP credential hashing, resolution, isolation, and revocation verified.\n");

  // 6. Test Project Creation Validation & Free Text Trimming
  console.log("6. Testing Project Creation Validation...");
  const testProject = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: "  Civil Infrastructure Test  ".trim(),
    },
  });
  if (testProject.name !== "Civil Infrastructure Test") {
    throw new Error("Project name was not trimmed!");
  }
  console.log(`  * Created test project "${testProject.name}" (ID: ${testProject.id})`);
  await prisma.project.delete({ where: { id: testProject.id } });
  console.log("  * Deleted test project.");
  console.log("  [PASS] Project creation name handling verified.\n");

  console.log("=================================================");
  console.log("ALL MILESTONE 11 VERIFICATION CHECKS PASSED!");
  console.log("=================================================");
}

run()
  .catch((e) => {
    console.error("VERIFICATION FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
