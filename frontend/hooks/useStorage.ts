"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Account = {
  account_index: number;
  email: string | null;
  is_connected: boolean;
  used: number;
  limit: number;
  free: number;
};

export function useStorage() {
  const { getToken } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);

  const refreshStorage = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/accounts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch {
    }
  }, [getToken]);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  return { accounts, refreshStorage };
}
