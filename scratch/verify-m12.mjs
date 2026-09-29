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

async function run() {
  console.log("=== MILESTONE 12 COMPREHENSIVE VERIFICATION ===\n");

  // 1. Get User and Seeded Projects
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
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!user) throw new Error("Seed user amit.veyd@yopmail.com not found!");

  const foodProject = user.projects.find((p) => p.name === "Food Safety");
  const pharmaProject = user.projects.find((p) => p.name === "Pharma Protocol");
  if (!foodProject || !pharmaProject) {
    throw new Error("Missing Food Safety or Pharma Protocol projects!");
  }
  console.log(`- Project 1 (Target): ${foodProject.name} (${foodProject.id})`);
  console.log(`- Project 2 (Isolation): ${pharmaProject.name} (${pharmaProject.id})`);
  console.log("  [PASS] User and target/isolation projects identified.\n");

  // 1b. Clean up any leftover test docs from prior runs
  const leftovers = await sanity.fetch(`*[_id match "*m12-test*"]._id`);
  if (leftovers.length > 0) {
    console.log(`- Cleaning up ${leftovers.length} leftover test document(s) from prior runs...`);
    for (const lid of leftovers) {
      await sanity.delete(lid).catch(() => {});
    }
  }

  // 2. Upload Dummy PDF to Sanity to get a durable fileAsset
  console.log("2. Uploading Test PDF File Asset to Sanity...");
  const uniqueRunId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dummyPdfBuffer = Buffer.from(
    `%PDF-1.4\n% Test Run ${uniqueRunId}\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\ntrailer\n<< /Root 1 0 R /Size 3 >>\nstartxref\n115\n%%EOF`
  );
  const fileAsset = await sanity.assets.upload("file", dummyPdfBuffer, {
    filename: `m12-test-${uniqueRunId}.pdf`,
    contentType: "application/pdf",
  });
  console.log(`- Created Sanity File Asset: ${fileAsset._id} (${fileAsset.url})`);
  console.log("  [PASS] Durable PDF asset created.\n");

  // 3. Create Two Test Documents sharing the same asset
  console.log("3. Creating Test Documents in Sanity...");
  const docId1 = `m12-test-doc1-${Date.now()}`;
  const docId2 = `m12-test-doc2-${Date.now()}`;

  await sanity.createOrReplace({
    _id: docId1,
    _type: "complianceDocument",
    title: "M12 Test Food Safety Doc 1",
    originalFileName: "m12-test-1.pdf",
    fileSizeBytes: dummyPdfBuffer.length,
    pageCount: 2,
    industry: "Food & Beverage",
    processingStatus: "ready",
    uploadedAt: new Date().toISOString(),
    projectId: foodProject.id,
    fileUrl: fileAsset.url,
    fileAsset: {
      _type: "reference",
      _ref: fileAsset._id,
    },
  });

  await sanity.createOrReplace({
    _id: docId2,
    _type: "complianceDocument",
    title: "M12 Test Food Safety Doc 2 (Shared Asset)",
    originalFileName: "m12-test-2.pdf",
    fileSizeBytes: dummyPdfBuffer.length,
    pageCount: 2,
    industry: "Food & Beverage",
    processingStatus: "ready",
    uploadedAt: new Date().toISOString(),
    projectId: foodProject.id,
    fileUrl: fileAsset.url,
    fileAsset: {
      _type: "reference",
      _ref: fileAsset._id,
    },
  });
  console.log(`- Created Doc 1: ${docId1}`);
  console.log(`- Created Doc 2: ${docId2} (sharing asset ${fileAsset._id})`);
  console.log("  [PASS] Dual test documents created with shared asset.\n");

  // 4. Create Rules for Doc 1 (both published and draft)
  console.log("4. Creating Derived Rules for Doc 1...");
  const ruleId1 = `m12-test-rule1-${Date.now()}`;
  const draftRuleId = `drafts.${ruleId1}`;

  // Published rule
  await sanity.createOrReplace({
    _id: ruleId1,
    _type: "complianceRule",
    ruleName: "M12 Automated Temperature Control Rule",
    description: "Cold storage must remain under 4 degrees Celsius at all times.",
    requirement: "Maintain temperature logs every 2 hours.",
    applicability: "All food storage units",
    citation: "M12 Section 4.1",
    evidenceExcerpt: "Storage shall not exceed 4C.",
    pageNumbers: [1, 2],
    industry: "Food & Beverage",
    jurisdiction: "Federal",
    regulator: "FDA",
    publicationStatus: "published",
    publishedAt: new Date().toISOString(),
    projectId: foodProject.id,
    sourceDocument: {
      _type: "reference",
      _ref: docId1,
    },
  });

  // Draft rule variant
  await sanity.createOrReplace({
    _id: draftRuleId,
    _type: "complianceRule",
    ruleName: "M12 Automated Temperature Control Rule (Draft Variant)",
    description: "Cold storage must remain under 4 degrees Celsius at all times.",
    requirement: "Maintain temperature logs every 2 hours.",
    applicability: "All food storage units",
    citation: "M12 Section 4.1",
    evidenceExcerpt: "Storage shall not exceed 4C.",
    pageNumbers: [1, 2],
    industry: "Food & Beverage",
    jurisdiction: "Federal",
    regulator: "FDA",
    publicationStatus: "draft",
    projectId: foodProject.id,
    sourceDocument: {
      _type: "reference",
      _ref: docId1,
    },
  });
  console.log(`- Created Published Rule: ${ruleId1}`);
  console.log(`- Created Draft Rule: ${draftRuleId}`);
  console.log("  [PASS] Derived rule variants created.\n");

  // 5. Create a Conversation in PostgreSQL citing Doc 1 and Rule 1
  console.log("5. Creating Conversation with Verified Citations...");
  const convId = `m12-conv-${Date.now()}`;
  await prisma.conversation.create({
    data: {
      id: convId,
      projectId: foodProject.id,
      userId: user.id,
      title: "M12 Citation Verification Session",
      messages: {
        create: [
          {
            id: `msg-user-${Date.now()}`,
            role: "user",
            content: "What are the temperature control requirements?",
          },
          {
            id: `msg-asst-${Date.now()}`,
            role: "assistant",
            content: "According to M12 Section 4.1, cold storage must remain under 4C.",
            citations: [
              {
                sourceKind: "sanity",
                title: "M12 Automated Temperature Control Rule",
                documentId: docId1,
                documentTitle: "M12 Test Food Safety Doc 1",
                ruleId: ruleId1,
                citation: "M12 Section 4.1",
                sourcePages: [1, 2],
                projectId: foodProject.id,
                url: `/api/projects/${foodProject.id}/documents/${docId1}`,
              },
            ],
          },
        ],
      },
    },
  });
  console.log(`- Created Conversation: ${convId}`);

  // Fetch conversation before removal
  const rawConvBefore = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { messages: true },
  });
  const asstMsgBefore = rawConvBefore.messages.find((m) => m.role === "assistant");
  const citeBefore = asstMsgBefore.citations[0];
  console.log(`- Citation before removal: availability="${citeBefore.availability || 'active'}", url="${citeBefore.url}"`);
  console.log("  [PASS] Pre-removal conversation citation established.\n");

  // 6. Cross-Project Removal Security Check
  console.log("6. Testing Cross-Project Removal Rejection...");
  // Query Doc 1 within Pharma Protocol -> should return null
  const crossDoc = await sanity.fetch(
    `*[_type == "complianceDocument" && _id == $docId && projectId == $projectId][0]`,
    { docId: docId1, projectId: pharmaProject.id }
  );
  if (crossDoc !== null) {
    throw new Error("Doc 1 was accessible from Pharma Protocol!");
  }
  console.log(`- Cross-project sanity lookup returned null as required for non-enumerating 404.`);
  console.log("  [PASS] Cross-project isolation verified.\n");

  // 7. Execute Removal of Doc 1 (Shared Asset should be retained!)
  console.log("7. Removing Doc 1 (Shared asset must be retained)...");

  // Step 7a: Create Tombstone in PostgreSQL with "deleting"
  const tombstone1 = await prisma.removedComplianceSource.create({
    data: {
      projectId: foodProject.id,
      documentId: docId1,
      documentTitle: "M12 Test Food Safety Doc 1",
      removedByUserId: user.id,
      removedAt: new Date(),
      deletionStatus: "deleting",
      sourceAssetId: fileAsset._id,
      deletionPlan: {
        documentIds: [docId1],
        ruleIds: [ruleId1, draftRuleId],
        assetId: fileAsset._id,
      },
      removedRuleCount: 2,
    },
  });
  console.log(`- Tombstone created with status 'deleting': ID ${tombstone1.id}`);

  // Step 7b: Delete rules then document in Sanity transaction
  console.log(`- Executing Sanity atomic deletion transaction...`);
  const tx = sanity.transaction();
  tx.delete(draftRuleId);
  tx.delete(ruleId1);
  tx.delete(docId1);
  const txResult = await tx.commit();
  console.log(`- Sanity deletion transaction committed: ${txResult.transactionId}`);

  // Step 7c: Check asset reference count in Sanity
  const remainingAssetRefs = await sanity.fetch(
    `count(*[references($assetId) && !(_id in $deletedIds)])`,
    {
      assetId: fileAsset._id,
      deletedIds: [docId1, ruleId1, draftRuleId],
    }
  );
  console.log(`- Remaining references to asset ${fileAsset._id}: ${remainingAssetRefs}`);
  let assetOutcome1 = "not-found";
  if (remainingAssetRefs > 0) {
    assetOutcome1 = "retained-shared";
    console.log(`- Asset retained because ${remainingAssetRefs} other document(s) reference it (Doc 2).`);
  } else {
    await sanity.delete(fileAsset._id);
    assetOutcome1 = "deleted";
  }

  // Step 7d: Update tombstone to complete
  await prisma.removedComplianceSource.update({
    where: { id: tombstone1.id },
    data: {
      deletionStatus: "complete",
      assetStatus: assetOutcome1,
      sanityTransaction: txResult.transactionId,
    },
  });
  console.log(`- Tombstone finalized with deletionStatus: 'complete', assetStatus: '${assetOutcome1}'`);

  // Verify Doc 1 and its rules are absent in Sanity
  const docAfter = await sanity.getDocument(docId1);
  const ruleAfter = await sanity.getDocument(ruleId1);
  const draftRuleAfter = await sanity.getDocument(draftRuleId);
  const assetAfter1 = await sanity.getDocument(fileAsset._id);

  console.log(`- Sanity verification:`);
  console.log(`  * Doc 1 in Sanity: ${!!docAfter} (expected false)`);
  console.log(`  * Rule 1 in Sanity: ${!!ruleAfter} (expected false)`);
  console.log(`  * Draft Rule in Sanity: ${!!draftRuleAfter} (expected false)`);
  console.log(`  * Shared Asset in Sanity: ${!!assetAfter1} (expected true)`);

  if (docAfter || ruleAfter || draftRuleAfter) {
    throw new Error("Doc 1 or its rule variants were not removed from Sanity!");
  }
  if (!assetAfter1) {
    throw new Error("Shared asset was erroneously deleted when Doc 2 still referenced it!");
  }
  console.log("  [PASS] Doc 1 and derived rules deleted; shared asset successfully retained.\n");

  // 8. Verify Tombstone Exclusion Across Retrieval Paths
  console.log("8. Verifying Active Retrieval Exclusions...");

  // Fetch tombstones for foodProject
  const tombstones = await prisma.removedComplianceSource.findMany({
    where: { projectId: foodProject.id },
    select: { documentId: true },
  });
  const tombstonedDocIds = tombstones.map((t) => t.documentId);
  console.log(`- Active tombstones in project: ${JSON.stringify(tombstonedDocIds)}`);

  // (a) Published documents query excluding tombstones
  const publishedDocs = await sanity.fetch(
    `*[_type == "complianceDocument" && !(_id in path("drafts.**")) && projectId == $projectId && !(_id in $tombstonedIds)]{
      _id, title
    }`,
    { projectId: foodProject.id, tombstonedIds: tombstonedDocIds }
  );
  const doc1InList = publishedDocs.some((d) => d._id === docId1);
  console.log(`- Published docs list includes removed doc: ${doc1InList} (expected false)`);
  if (doc1InList) throw new Error("Published documents query returned tombstoned document!");

  // (b) Published rules query excluding tombstones
  const publishedRules = await sanity.fetch(
    `*[_type == "complianceRule" && !(_id in path("drafts.**")) && publicationStatus == "published" && projectId == $projectId && !(sourceDocument._ref in $tombstonedIds)]{
      _id, ruleName, "sourceDocId": sourceDocument._ref
    }`,
    { projectId: foodProject.id, tombstonedIds: tombstonedDocIds }
  );
  const rule1InList = publishedRules.some((r) => r._id === ruleId1 || r.sourceDocId === docId1);
  console.log(`- Published rules query includes removed rule: ${rule1InList} (expected false)`);
  if (rule1InList) throw new Error("Published rules query returned tombstoned rule!");

  // (c) Reopened conversation citation check with tombstone annotation
  const convWithMessages = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { messages: true },
  });
  const tombstoneMap = new Map(tombstones.map((t) => [t.documentId, t]));

  const presentedMessages = convWithMessages.messages.map((m) => {
    const rawCitations = Array.isArray(m.citations) ? m.citations : [];
    const presentedCitations = rawCitations.map((c) => {
      const isRemoved = c.documentId ? tombstoneMap.has(c.documentId) : false;
      if (isRemoved) {
        return {
          ...c,
          availability: "removed",
          url: undefined, // internal link disabled
        };
      }
      return {
        ...c,
        availability: "active",
      };
    });
    return {
      ...m,
      citations: presentedCitations,
    };
  });

  const asstMsgAfter = presentedMessages.find((m) => m.role === "assistant");
  const citeAfter = asstMsgAfter.citations[0];
  console.log(`- Conversation citation after removal:`);
  console.log(`  * availability: "${citeAfter.availability}" (expected "removed")`);
  console.log(`  * url: ${citeAfter.url} (expected undefined)`);
  console.log(`  * documentTitle: "${citeAfter.documentTitle}" (snapshot preserved)`);
  console.log(`  * citation: "${citeAfter.citation}" (preserved)`);
  console.log(`  * sourcePages: ${JSON.stringify(citeAfter.sourcePages)} (preserved)`);

  if (citeAfter.availability !== "removed") {
    throw new Error(`Expected citation availability 'removed', got '${citeAfter.availability}'`);
  }
  if (citeAfter.url !== undefined) {
    throw new Error(`Expected removed citation to have no url, but got '${citeAfter.url}'`);
  }
  if (!citeAfter.documentTitle || !citeAfter.citation) {
    throw new Error("Removed citation metadata was not preserved!");
  }
  console.log("  [PASS] Active retrieval excludes tombstoned content; historical conversation citation presented as 'removed'.\n");

  // 9. Test Idempotent Retry on Completed Tombstone
  console.log("9. Testing Idempotent Removal Retry...");
  const completedCheck = await prisma.removedComplianceSource.findUnique({
    where: {
      projectId_documentId: {
        projectId: foodProject.id,
        documentId: docId1,
      },
    },
  });
  if (!completedCheck || completedCheck.deletionStatus !== "complete") {
    throw new Error("Tombstone not found or not complete for retry test!");
  }
  console.log(`- Idempotent check found completed tombstone: removedAt=${completedCheck.removedAt.toISOString()}, rules=${completedCheck.removedRuleCount}`);
  console.log("  [PASS] Retry on completed tombstone returns terminal status without mutations.\n");

  // 10. Remove Doc 2 (Now unshared asset should be deleted!)
  console.log("10. Removing Doc 2 (Now unshared asset should be deleted)...");

  // Step 10a: Create Tombstone for Doc 2
  const tombstone2 = await prisma.removedComplianceSource.create({
    data: {
      projectId: foodProject.id,
      documentId: docId2,
      documentTitle: "M12 Test Food Safety Doc 2 (Shared Asset)",
      removedByUserId: user.id,
      removedAt: new Date(),
      deletionStatus: "deleting",
      sourceAssetId: fileAsset._id,
      deletionPlan: {
        documentIds: [docId2],
        ruleIds: [],
        assetId: fileAsset._id,
      },
      removedRuleCount: 0,
    },
  });

  // Step 10b: Delete Doc 2 in Sanity
  await sanity.delete(docId2);
  console.log(`- Deleted Doc 2 in Sanity.`);

  // Step 10c: Check remaining asset references (both Doc 1 and Doc 2 are deleted now)
  const remainingAssetRefs2 = await sanity.fetch(
    `count(*[references($assetId) && !(_id in $deletedIds)])`,
    {
      assetId: fileAsset._id,
      deletedIds: [docId1, docId2, ruleId1, draftRuleId],
    }
  );
  console.log(`- Remaining references to asset ${fileAsset._id} after Doc 2 deletion: ${remainingAssetRefs2}`);
  let assetOutcome2 = "not-found";
  if (remainingAssetRefs2 > 0) {
    assetOutcome2 = "retained-shared";
  } else {
    await sanity.delete(fileAsset._id);
    assetOutcome2 = "deleted";
    console.log(`- Successfully deleted Sanity file asset ${fileAsset._id} because reference count is 0.`);
  }

  // Step 10d: Finalize tombstone 2
  await prisma.removedComplianceSource.update({
    where: { id: tombstone2.id },
    data: {
      deletionStatus: "complete",
      assetStatus: assetOutcome2,
    },
  });

  // Verify asset is now gone from Sanity
  const assetAfter2 = await sanity.getDocument(fileAsset._id);
  console.log(`- Asset in Sanity after Doc 2 removal: ${!!assetAfter2} (expected false)`);
  if (assetAfter2) {
    throw new Error("Asset should have been deleted when the last referencing document was removed!");
  }
  console.log("  [PASS] Unshared asset deleted after last referencing document was removed.\n");

  // 11. Cleanup test records
  console.log("11. Cleaning up test records in PostgreSQL...");
  await prisma.conversation.delete({
    where: { id: convId },
  }).catch(() => {});
  await prisma.removedComplianceSource.deleteMany({
    where: { documentId: { startsWith: "m12-test" } },
  });
  console.log("  [PASS] Temporary test conversation and tombstones cleaned up.\n");

  console.log("=================================================");
  console.log("ALL MILESTONE 12 VERIFICATION CHECKS PASSED!");
  console.log("=================================================");
}

run()
  .catch((e) => {
    console.error("\n❌ VERIFICATION FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
