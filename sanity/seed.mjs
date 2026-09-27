// Seeds Sanity Content Model for Milestone 2:
// - One complianceDocument with an uploaded PDF asset
// - One published complianceRule
// - One draft complianceRule (drafts.rule-pending-review) for draft isolation verification
// - One conversation
// - Two messages (one user, one assistant with citations)
//
// Usage:  node sanity/seed.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
      return;
    } catch {}
  }
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {}
}

const candidateDirs = [
  path.resolve(__dirname, ".."),
  process.cwd(),
  __dirname,
];

for (const dir of candidateDirs) {
  loadEnv(path.join(dir, ".env.local"));
  loadEnv(path.join(dir, ".env"));
}

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  "production";
const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01";
const token =
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_AUTH_TOKEN ||
  process.env.SANITY_API_TOKEN;

if (!projectId || !token) {
  console.error("❌ Error: Missing Sanity projectId or write token.");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

async function seed() {
  console.log(`🌱 Seeding Sanity dataset "${dataset}" in project "${projectId}"...`);

  // 1. Upload a minimal valid PDF asset
  const minimalPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
  );
  
  console.log("Uploading sample PDF asset...");
  const asset = await client.assets.upload("file", minimalPdf, {
    filename: "fda-fsma-guidance-sample.pdf",
    contentType: "application/pdf",
  });
  console.log(`Uploaded asset: ${asset._id}`);

  // 2. Create complianceDocument
  const document = {
    _id: "doc-fda-fsma-2026",
    _type: "complianceDocument",
    title: "FDA Food Safety Modernization Act Guidance",
    fileAsset: {
      _type: "file",
      asset: {
        _type: "reference",
        _ref: asset._id,
      },
    },
    industry: "Food Processing",
    originalFileName: "fda-fsma-guidance-sample.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 10240,
    pageCount: 12,
    processingStatus: "ready",
    extractionModel: "gemini-2.0-flash",
    extractedRuleCount: 2,
    uploadedAt: "2026-03-01T10:00:00Z",
    extractionCompletedAt: "2026-03-01T10:02:30Z",
  };

  // 3. Create published complianceRule
  const publishedRule = {
    _id: "rule-fda-allergen-control",
    _type: "complianceRule",
    ruleName: "Mandatory Allergen Cross-Contact Prevention Controls",
    description:
      "Food facilities must establish and implement preventive controls to significantly minimize or prevent allergen cross-contact during manufacturing, processing, packing, and holding.",
    requirement:
      "Establish written allergen preventive controls including dedicated production lines, verified sanitation procedures between allergen and non-allergen runs, and clear packaging validation.",
    applicability:
      "All FDA-registered facilities manufacturing, packing, or holding food products containing any of the 9 major food allergens.",
    industry: "Food Processing",
    jurisdiction: "US-Federal (FDA)",
    regulator: "FDA",
    citation: "21 CFR 117.135(c)(2)",
    evidenceExcerpt:
      "The owner, operator, or agent in charge of a facility must identify and implement preventive controls... Allergen controls include procedures, practices, and processes to ensure protection of food from allergen cross-contact.",
    sourcePages: [4, 5, 8],
    keywords: [
      "allergen",
      "cross-contact",
      "labeling",
      "preventive controls",
      "sanitation",
      "haccp",
    ],
    sourceDocument: {
      _type: "reference",
      _ref: "doc-fda-fsma-2026",
    },
    freshnessStatus: "current",
    effectiveDate: "2026-01-01",
    expiresAt: "2028-12-31",
    lastReviewedAt: "2026-03-01T12:00:00Z",
  };

  // 4. Create draft complianceRule (drafts. prefix guarantees draft isolation testing)
  const draftRule = {
    _id: "drafts.rule-pending-review",
    _type: "complianceRule",
    ruleName: "Draft Environmental Pathogen Monitoring Procedure",
    description:
      "Unreviewed draft rule extracted from Section 4 regarding listeria swab frequency.",
    requirement:
      "Facilities must conduct weekly sponge swabs of non-food contact surfaces in ready-to-eat packaging zones.",
    applicability: "Ready-to-eat meat and poultry facilities.",
    industry: "Food Processing",
    jurisdiction: "US-Federal (USDA)",
    regulator: "USDA/FSIS",
    citation: "9 CFR 430.4",
    evidenceExcerpt:
      "Testing of environmental surfaces for verification of sanitation controls.",
    sourcePages: [9],
    keywords: ["pathogen", "listeria", "environmental monitoring", "swabbing"],
    sourceDocument: {
      _type: "reference",
      _ref: "doc-fda-fsma-2026",
    },
    freshnessStatus: "current",
  };

  // 5. Create conversation
  const conversation = {
    _id: "conv-m2-test-session",
    _type: "conversation",
    createdAt: "2026-03-15T14:00:00Z",
    updatedAt: "2026-03-15T14:01:30Z",
  };

  // 6. Create two messages
  const userMessage = {
    _id: "msg-m2-user-001",
    _type: "message",
    conversation: {
      _type: "reference",
      _ref: "conv-m2-test-session",
    },
    role: "user",
    content: "What are the allergen cross-contact preventive requirements for food facilities?",
    createdAt: "2026-03-15T14:00:05Z",
  };

  const assistantMessage = {
    _id: "msg-m2-assistant-002",
    _type: "message",
    conversation: {
      _type: "reference",
      _ref: "conv-m2-test-session",
    },
    role: "assistant",
    content:
      "Under 21 CFR 117.135(c)(2), food facilities must establish and implement written allergen preventive controls to significantly minimize or prevent allergen cross-contact across storage, manufacturing, and packaging lines.",
    createdAt: "2026-03-15T14:00:30Z",
    citations: [
      {
        _key: "cit-fda-1",
        sourceKind: "sanity",
        title: "Mandatory Allergen Cross-Contact Prevention Controls",
        ruleId: "rule-fda-allergen-control",
        documentId: "doc-fda-fsma-2026",
        citation: "21 CFR 117.135(c)(2)",
      },
    ],
  };

  const tx = client.transaction();
  [document, publishedRule, draftRule, conversation, userMessage, assistantMessage].forEach(
    (doc) => tx.createOrReplace(doc)
  );

  await tx.commit();
  console.log("✅ Seed completed successfully!");
  console.log("Created:");
  console.log("  - 1 complianceDocument (doc-fda-fsma-2026)");
  console.log("  - 1 published complianceRule (rule-fda-allergen-control)");
  console.log("  - 1 draft complianceRule (drafts.rule-pending-review)");
  console.log("  - 1 conversation (conv-m2-test-session)");
  console.log("  - 2 messages (msg-m2-user-001, msg-m2-assistant-002)");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
