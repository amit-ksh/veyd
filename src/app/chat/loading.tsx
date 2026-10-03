import { AppSkeleton } from "@/components/ui/app-skeleton";

export default function ChatLoading() {
  return <AppSkeleton activeTab="chat" label="Connecting to Copilot…" />;
}
