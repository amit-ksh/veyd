import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@sanity/client";

const prisma = new PrismaClient();

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

async function runMigration() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`=== RUNNING PROJECT CONTEXT MIGRATION (${isDryRun ? "DRY RUN" : "LIVE APPLY"}) ===`);

  const mappingPath = path.resolve("scripts/legacy-migration-map.json");
  if (!fs.existsSync(mappingPath)) {
    throw new Error(`Missing mapping file at ${mappingPath}`);
  }

  const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));

  // 1. Fetch all existing projects from PostgreSQL
  const projects = await prisma.project.findMany();
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  console.log(`Loaded ${projects.length} destination projects from PostgreSQL.`);

  // Validate all destination projects exist
  for (const [scope, entries] of Object.entries({
    conversations: mapping.conversations,
    documents: mapping.documents,
    rules: mapping.rules,
  })) {
    for (const [recId, projId] of Object.entries(entries)) {
      if (!projectMap.has(projId)) {
        throw new Error(`Destination project ${projId} for ${scope} record ${recId} does not exist in PostgreSQL!`);
      }
    }
  }

  // 2. Inventory and validate PostgreSQL conversations
  const dbConversations = await prisma.conversation.findMany({ select: { id: true, userId: true } });
  console.log(`Checking ${dbConversations.length} PostgreSQL conversations...`);
  for (const conv of dbConversations) {
    const targetProjectId = mapping.conversations[conv.id];
    if (!targetProjectId) {
      throw new Error(`Conversation ${conv.id} is unmapped! All legacy records must have explicit mappings.`);
    }
    const targetProject = projectMap.get(targetProjectId);
    // Invariant 1: conversation's userId equals destination project's ownerId
    if (conv.userId !== targetProject.ownerId) {
      throw new Error(
        `Invariant violation: Conversation ${conv.id} owner (${conv.userId}) does not match destination project owner (${targetProject.ownerId})`
      );
    }
  }
  console.log("✓ Invariant 1 verified: All mapped conversations match their destination project owner.");

  // 3. Inventory and validate Sanity documents
  const sanityDocs = await sanity.fetch(`*[_type == "complianceDocument"]{ _id, title, projectId }`);
  console.log(`Checking ${sanityDocs.length} Sanity compliance documents...`);
  for (const doc of sanityDocs) {
    const baseId = doc._id.replace(/^drafts\./, "");
    const targetProjectId = mapping.documents[doc._id] || mapping.documents[baseId];
    if (!targetProjectId) {
      throw new Error(`Compliance document ${doc._id} (${doc.title}) is unmapped!`);
    }
  }
  console.log("✓ All compliance documents have valid project assignments.");

  // 4. Inventory and validate Sanity rules & Invariant 2 (rule's project matches source document's project)
  const sanityRules = await sanity.fetch(
    `*[_type == "complianceRule"]{ _id, ruleName, sourceDocument, projectId }`
  );
  console.log(`Checking ${sanityRules.length} Sanity compliance rules...`);
  for (const rule of sanityRules) {
    const baseId = rule._id.replace(/^drafts\./, "");
    const targetProjectId = mapping.rules[rule._id] || mapping.rules[baseId];
    if (!targetProjectId) {
      throw new Error(`Compliance rule ${rule._id} (${rule.ruleName || "unnamed"}) is unmapped!`);
    }

    if (rule.sourceDocument && rule.sourceDocument._ref) {
      const docRef = rule.sourceDocument._ref.replace(/^drafts\./, "");
      const expectedDocProject = mapping.documents[rule.sourceDocument._ref] || mapping.documents[docRef];
      if (expectedDocProject && expectedDocProject !== targetProjectId) {
        throw new Error(
          `Invariant violation: Rule ${rule._id} assigned to ${targetProjectId} but its source document ${rule.sourceDocument._ref} is assigned to ${expectedDocProject}!`
        );
      }
    }
  }
  console.log("✓ Invariant 2 verified: Every rule is assigned to the same project as its source document.");

  if (isDryRun) {
    console.log("\n[DRY RUN SUCCESSFUL] All mappings valid and all invariants strictly satisfied.");
    return;
  }

  // 5. Apply migration in PostgreSQL
  console.log("\nApplying PostgreSQL conversation updates...");
  for (const conv of dbConversations) {
    const targetProjectId = mapping.conversations[conv.id];
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { projectId: targetProjectId },
    });
    console.log(`Updated conversation ${conv.id} -> projectId: ${targetProjectId}`);
  }

  // 6. Apply migration in Sanity
  console.log("\nApplying Sanity compliance document updates...");
  for (const doc of sanityDocs) {
    const baseId = doc._id.replace(/^drafts\./, "");
    const targetProjectId = mapping.documents[doc._id] || mapping.documents[baseId];
    await sanity.patch(doc._id).set({ projectId: targetProjectId }).commit();
    console.log(`Updated document ${doc._id} -> projectId: ${targetProjectId}`);
  }

  console.log("\nApplying Sanity compliance rule updates...");
  for (const rule of sanityRules) {
    const baseId = rule._id.replace(/^drafts\./, "");
    const targetProjectId = mapping.rules[rule._id] || mapping.rules[baseId];
    await sanity.patch(rule._id).set({ projectId: targetProjectId }).commit();
    console.log(`Updated rule ${rule._id} -> projectId: ${targetProjectId}`);
  }

  console.log("\n=== MIGRATION APPLIED SUCCESSFULLY ===");
}

runMigration()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
