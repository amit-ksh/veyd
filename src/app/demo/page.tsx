import { redirect } from "next/navigation";

// Preserve existing presentation bookmarks after the route rename.
export default function LegacyDemoPage() {
  redirect("/presentation");
}
