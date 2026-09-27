import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Veyd | Regulatory Documents",
  description: "Upload and manage regulatory compliance documents and rule extraction",
};

export default function DocumentsPage() {
  return <AppShell initialTab="documents" />;
}
