import type { Metadata } from "next";
import { DemoPresentation } from "./presentation";

export const metadata: Metadata = {
  title: "Veyd: one place to research, learn, and build across domains",
  description:
    "A question-by-question presentation of Veyd: project documents, human-reviewed knowledge, cited research and reusable handbooks, built on Sanity.",
};

export default function PresentationPage() {
  return <DemoPresentation />;
}
