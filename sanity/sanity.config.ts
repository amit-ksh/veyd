import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";
import { structure } from "./structure";

export default defineConfig({
  name: "compliance-handbook-studio",
  title: "Veyd Studio",
  projectId:
    process.env.SANITY_STUDIO_PROJECT_ID ||
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    "erhznx84",
  dataset:
    process.env.SANITY_STUDIO_DATASET ||
    process.env.NEXT_PUBLIC_SANITY_DATASET ||
    "production",
  plugins: [
    structureTool({
      structure,
    }),
    visionTool(),
  ],
  schema: { types: schemaTypes },
});
