// Populates a starter dataset: Food Processing industry, three onboarding
// chapters, and the compliance rules they reference — matching the kind of
// company (e.g. Tyson Foods-style meat/poultry processor) this engine targets.
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
    } catch {
      // Fall through to manual parsing if process.loadEnvFile encounters an issue
    }
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

// Load .env files from parent (project root), current working dir, or sanity dir
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
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-01-01";
const token =
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_AUTH_TOKEN ||
  process.env.SANITY_API_TOKEN;

if (!projectId) {
  console.error(
    "❌ Error: Missing Sanity Project ID. Please configure NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_STUDIO_PROJECT_ID in .env"
  );
  process.exit(1);
}

if (!token) {
  console.error(
    "❌ Error: Missing Sanity write token. Please configure SANITY_API_WRITE_TOKEN in .env"
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

const industry = {
  _id: "industry.food-processing",
  _type: "industry",
  title: "Food Processing",
  slug: { current: "food-processing" },
  icon: "🍗",
  summary: "Meat, poultry, and prepared-foods processors regulated by USDA/FSIS and FDA.",
};

const rules = [
  {
    _id: "rule.hazard-analysis",
    _type: "complianceRule",
    title: "Hazard Analysis & Critical Control Points (HACCP) plan",
    slug: { current: "haccp-plan" },
    severity: "critical",
    jurisdiction: "US-Federal (USDA/FSIS)",
    citation: "9 CFR 417",
    description:
      "Every meat and poultry establishment must have a written HACCP plan identifying food-safety hazards and critical control points.",
    checklist: [
      "Written HACCP plan on file and signed by a trained individual",
      "Critical control points identified for each product category",
      "Monitoring records kept for at least the last 12 months",
      "Corrective-action log exists for any CCP deviation",
    ],
    lastReviewed: "2026-06-01",
  },
  {
    _id: "rule.allergen-labeling",
    _type: "complianceRule",
    title: "Allergen labeling (FALCPA)",
    slug: { current: "allergen-labeling" },
    severity: "high",
    jurisdiction: "US-Federal (FDA)",
    citation: "21 U.S.C. 343(w)",
    description:
      "Packaged food must clearly declare any of the nine major food allergens present in the product.",
    checklist: [
      "\"Contains\" statement lists all major allergens present",
      "Ingredient list cross-checked against current recipe/formulation",
      "Label proof approved by QA before print run",
    ],
    lastReviewed: "2026-03-15",
  },
  {
    _id: "rule.sanitation-spss",
    _type: "complianceRule",
    title: "Sanitation Standard Operating Procedures (Sanitation SOPs)",
    slug: { current: "sanitation-sops" },
    severity: "critical",
    jurisdiction: "US-Federal (USDA/FSIS)",
    citation: "9 CFR 416.11-416.17",
    description:
      "Establishments must maintain written Sanitation SOPs describing daily pre-operational and operational cleaning procedures.",
    checklist: [
      "Written Sanitation SOP covers pre-op and operational sanitation",
      "Daily sanitation records signed and dated",
      "Corrective actions documented for any sanitation failure",
    ],
    lastReviewed: "2026-05-20",
  },
  {
    _id: "rule.worker-safety-osha",
    _type: "complianceRule",
    title: "Worker safety — process safety & PPE (OSHA)",
    slug: { current: "worker-safety-osha" },
    severity: "medium",
    jurisdiction: "US-Federal (OSHA)",
    citation: "29 CFR 1910",
    description: "Processing-line workers must be provided appropriate PPE and safety training for their role.",
    checklist: [
      "PPE provided and documented for line workers (cut-resistant gloves, etc.)",
      "New-hire safety training completed and logged within first week",
      "Lockout/tagout procedures posted at relevant equipment",
    ],
    lastReviewed: "2026-01-10",
  },
];

const chapters = [
  {
    _id: "chapter.welcome",
    _type: "chapter",
    title: "Welcome & why compliance matters here",
    slug: { current: "welcome" },
    industry: { _type: "reference", _ref: "industry.food-processing" },
    order: 1,
    summary: "What this handbook covers and why HACCP is the backbone of everything else.",
    estimatedMinutes: 4,
    body: [
      {
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: "Welcome to the team. Food processing is one of the most heavily regulated industries in the country — for good reason. This handbook walks you through the rules that actually apply to your day-to-day work, not just the ones that sound important.",
          },
        ],
      },
    ],
    rules: [{ _type: "reference", _ref: "rule.hazard-analysis" }],
  },
  {
    _id: "chapter.labeling",
    _type: "chapter",
    title: "Labeling & allergens",
    slug: { current: "labeling-allergens" },
    industry: { _type: "reference", _ref: "industry.food-processing" },
    order: 2,
    summary: "How to get allergen declarations right, every time.",
    estimatedMinutes: 6,
    body: [
      {
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: "A missed allergen on a label is one of the most common causes of a recall. This chapter covers what to check before any label goes to print.",
          },
        ],
      },
    ],
    rules: [{ _type: "reference", _ref: "rule.allergen-labeling" }],
  },
  {
    _id: "chapter.sanitation-safety",
    _type: "chapter",
    title: "Sanitation & worker safety",
    slug: { current: "sanitation-safety" },
    industry: { _type: "reference", _ref: "industry.food-processing" },
    order: 3,
    summary: "Daily sanitation SOPs and the safety gear you're required to wear on the line.",
    estimatedMinutes: 5,
    body: [
      {
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: "Sanitation and safety failures are the two things inspectors check first. Here's what 'done right' looks like.",
          },
        ],
      },
    ],
    rules: [
      { _type: "reference", _ref: "rule.sanitation-spss" },
      { _type: "reference", _ref: "rule.worker-safety-osha" },
    ],
  },
];

const tx = client.transaction();
[industry, ...rules, ...chapters].forEach((doc) => tx.createOrReplace(doc));

tx.commit()
  .then(() => console.log("✅ Seeded Food Processing industry, rules, and chapters."))
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  });
