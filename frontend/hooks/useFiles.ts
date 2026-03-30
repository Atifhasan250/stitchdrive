"use client";

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
  const [files, setFiles] = useState<FileItem[]>([]);

  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    refreshFiles();
    const t = setInterval(refreshFiles, 4000);
    return () => clearInterval(t);
  }, [refreshFiles]);

  return { files, refreshFiles };
}
