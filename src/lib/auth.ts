import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

// Central auth config. Add OAuth providers as your onboarding flow needs them —
// e.g. Google/Microsoft SSO for enterprise workspaces going through compliance
// onboarding. Email+password is enabled by default so the app works out of the box.
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day
  },
  // Every new user needs a place to land: give them a personal workspace so
  // "User -> Workspace -> Handbook" holds even before they join/create a company one.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const workspace = await prisma.workspace.create({
            data: {
              name: `${user.name ?? user.email.split("@")[0]}'s Workspace`,
              slug: `${user.id}-workspace`,
              industrySlug: "general",
            },
          });
          await prisma.membership.create({
            data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
