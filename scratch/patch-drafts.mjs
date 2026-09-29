import { createClient } from "@sanity/client";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-03-01",
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
});

const draftUpdates = [
  { id: "drafts.0d7b9ddd-fac0-45f5-8017-1e2131be07d1", projectId: "cmum60ekc0003b7hktqfirvvo" },
  { id: "drafts.bd9ec71a-baf9-43f7-959c-6a1c19404c1a", projectId: "cmum60ekc0003b7hktqfirvvo" },
  { id: "drafts.rule-pending-review", projectId: "cmum60e110001b7hkfor0yx83" },
];

async function updateDrafts() {
  for (const item of draftUpdates) {
    await client.patch(item.id).set({ projectId: item.projectId }).commit();
    console.log(`Updated draft ${item.id} -> projectId: ${item.projectId}`);
  }
}

updateDrafts().catch(console.error);
