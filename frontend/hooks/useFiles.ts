"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

export type FileItem = {
  id: string;
  file_name: string;
  drive_file_id: string;
  account_index: number;
  size: number;
  mime_type: string | null;
  has_thumbnail: boolean;
  parent_drive_file_id: string | null;
  created_at: string;
};

export function useFiles() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);

  const refreshFiles = useCallback(async () => {
    try {
      const token = await getToken();
      const creds = localStorage.getItem("credentials");
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (creds) headers["X-Credentials"] = creds;

      const res = await fetch("/api/files", {
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("[useFiles] Error:", err);
    }
  }, [getToken]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return { files, refreshFiles };
}
