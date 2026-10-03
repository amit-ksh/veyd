"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/auth-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return (
    <UserQueryProvider key={session?.user.id || "anonymous"}>
      {children}
    </UserQueryProvider>
  );
}

function UserQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(
    () => () => {
      void client.cancelQueries();
      client.clear();
    },
    [client],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
