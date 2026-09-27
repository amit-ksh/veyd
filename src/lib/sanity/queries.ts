import { sanityClient } from "./client";

// --- Types mirroring the Sanity schema (see /sanity/schemaTypes) ---

export interface Industry {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  icon?: string;
  chapterCount?: number;
}

export interface Chapter {
  _id: string;
  title: string;
  slug: string;
  order: number;
  summary: string;
  body: unknown; // Portable Text
  estimatedMinutes: number;
  rules: ComplianceRule[];
}

export interface ComplianceRule {
  _id: string;
  title: string;
  slug: string;
  severity: "critical" | "high" | "medium" | "low";
  jurisdiction: string;
  citation: string;
  description: string;
  checklist: string[];
  lastReviewed: string;
}

// --- Queries ---

export const industriesQuery = /* groq */ `
  *[_type == "industry"] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    summary,
    icon,
    "chapterCount": count(*[_type == "chapter" && references(^._id)])
  }
`;

export const industryBySlugQuery = /* groq */ `
  *[_type == "industry" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, summary, icon
  }
`;

export const chaptersByIndustryQuery = /* groq */ `
  *[_type == "chapter" && industry->slug.current == $industrySlug] | order(order asc) {
    _id,
    title,
    "slug": slug.current,
    order,
    summary,
    estimatedMinutes,
    "rules": rules[]->{
      _id, title, "slug": slug.current, severity, jurisdiction, citation, description, checklist, lastReviewed
    }
  }
`;

export const chapterBySlugQuery = /* groq */ `
  *[_type == "chapter" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    order,
    summary,
    body,
    estimatedMinutes,
    "rules": rules[]->{
      _id, title, "slug": slug.current, severity, jurisdiction, citation, description, checklist, lastReviewed
    }
  }
`;

export const ruleBySlugQuery = /* groq */ `
  *[_type == "complianceRule" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, severity, jurisdiction, citation, description, checklist, lastReviewed
  }
`;

export const searchRulesQuery = /* groq */ `
  *[_type == "complianceRule" && (title match $q + "*" || description match $q + "*")] | order(severity desc) [0...10] {
    _id, title, "slug": slug.current, severity, jurisdiction, citation, description, checklist, lastReviewed
  }
`;

// --- Fetch helpers (server-side) ---

export const getIndustries = () => sanityClient.fetch<Industry[]>(industriesQuery);

export const getIndustryBySlug = (slug: string) =>
  sanityClient.fetch<Industry | null>(industryBySlugQuery, { slug });

export const getChaptersByIndustry = (industrySlug: string) =>
  sanityClient.fetch<Chapter[]>(chaptersByIndustryQuery, { industrySlug });

export const getChapterBySlug = (slug: string) =>
  sanityClient.fetch<Chapter | null>(chapterBySlugQuery, { slug });

export const getRuleBySlug = (slug: string) =>
  sanityClient.fetch<ComplianceRule | null>(ruleBySlugQuery, { slug });

export const searchRules = (q: string) =>
  sanityClient.fetch<ComplianceRule[]>(searchRulesQuery, { q });
