import { PrismaClient } from "@prisma/client";
import { createClient } from "@sanity/client";

const prisma = new PrismaClient();

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-03-01",
  token: process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
});

async function inventory() {
  console.log("=== INVENTORY OF EXISTING RECORDS ===");

  // 1. Prisma
  const userCount = await prisma.user.count();
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const conversationCount = await prisma.conversation.count();
  const conversations = await prisma.conversation.findMany({
    select: { id: true, userId: true, title: true, createdAt: true },
  });

  console.log(`Users (${userCount}):`, users);
  console.log(`Conversations (${conversationCount}):`, conversations);

  // 2. Sanity
  const docs = await sanity.fetch(`*[_type == "complianceDocument"]{ _id, title, industry, projectId }`);
  console.log(`Sanity Compliance Documents (${docs.length}):`, docs);

  const rules = await sanity.fetch(`*[_type == "complianceRule"]{ _id, ruleName, sourceDocument, projectId }`);
  console.log(`Sanity Compliance Rules (${rules.length}):`, rules);

  await prisma.$disconnect();
}

inventory().catch((err) => {
  console.error("Inventory failed:", err);
  process.exit(1);
});
