import { createClient } from "@sanity/client";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-03-01",
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
});

async function main() {
  const unmapped = await client.fetch(
    `*[_type in ["complianceDocument", "complianceRule"] && !defined(projectId)]{
      _id,
      _type,
      "sourceDocRef": sourceDocument._ref
    }`
  );
  console.log("Unmapped records in Sanity:", JSON.stringify(unmapped, null, 2));
}

main().catch(console.error);
