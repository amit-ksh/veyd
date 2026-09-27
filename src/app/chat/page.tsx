import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Compliance Research Chat",
  description: "AI-assisted compliance research and regulation handbook",
};

export default function ChatPage() {
  return <AppShell initialTab="chat" />;
}
