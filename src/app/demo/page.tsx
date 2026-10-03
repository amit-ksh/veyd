import type { Metadata } from "next";
import { DemoPresentation } from "./presentation";

export const metadata: Metadata = {
  title: "Veyd — DEV × Sanity Demo",
  description:
    "A question-by-question presentation of Veyd: project documents, human-reviewed knowledge, cited research and reusable handbooks, built on Sanity.",
};

export default function DemoPage() {
  return <DemoPresentation />;
}
