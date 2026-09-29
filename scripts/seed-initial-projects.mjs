import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "amit.veyd@yopmail.com" },
  });

  if (!user) {
    throw new Error("Target user amit.veyd@yopmail.com not found!");
  }

  console.log("Found user:", user.id, user.email);

  // 1. Food Safety Project
  let foodProject = await prisma.project.findFirst({
    where: { ownerId: user.id, name: "Food Safety" },
  });
  if (!foodProject) {
    foodProject = await prisma.project.create({
      data: {
        ownerId: user.id,
        name: "Food Safety",
      },
    });
    console.log("Created Food Safety project:", foodProject.id);
  } else {
    console.log("Existing Food Safety project:", foodProject.id);
  }

  // 2. Pharma Protocol Project
  let pharmaProject = await prisma.project.findFirst({
    where: { ownerId: user.id, name: "Pharma Protocol" },
  });
  if (!pharmaProject) {
    pharmaProject = await prisma.project.create({
      data: {
        ownerId: user.id,
        name: "Pharma Protocol",
      },
    });
    console.log("Created Pharma Protocol project:", pharmaProject.id);
  } else {
    console.log("Existing Pharma Protocol project:", pharmaProject.id);
  }

  return { foodProject, pharmaProject };
}

main()
  .then((res) => {
    console.log("PROJECTS_INITIALIZED:", JSON.stringify(res));
  })
  .catch((err) => {
    console.error("Failed to seed projects:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
