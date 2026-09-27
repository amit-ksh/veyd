"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ShieldCheck, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function Sidebar({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const base = `/workspace/${workspaceId}`;
  const items = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    { href: `${base}/handbook`, label: "Handbook", icon: BookOpen },
    { href: `${base}/verify`, label: "Verify", icon: ShieldCheck },
  ];

  return (
    <aside className="flex h-screen w-60 flex-col justify-between border-r border-black/5 bg-white/60 p-4">
      <div>
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-slate-400">Workspace</p>
        <p className="mb-6 px-2 text-sm font-semibold text-brand-700">{workspaceName}</p>
        <nav className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-brand-100 text-brand-700 font-medium" : "text-slate-600 hover:bg-brand-50"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-brand-50"
      >
        <LogOut size={16} /> Sign out
      </button>
    </aside>
  );
}
