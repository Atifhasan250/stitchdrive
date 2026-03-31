"use client";

import { useStorage } from "@/hooks/useStorage";
import { useUpload } from "@/contexts/UploadContext";
import { useState } from "react";
import type { FileItem } from "@/hooks/useFiles";

export default function MoveToAccountModal({
  file,
  onClose,
  onSuccess,
}: {
  file: FileItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { accounts } = useStorage();
  const { upload, toast, updateToast, confirm } = useUpload();
  const [moving, setMoving] = useState(false);

  // Filter out the account the file is already in
  const otherAccounts = accounts.filter((a) => a.account_index !== file.account_index && a.is_connected);

  async function handleMove(targetAccountIndex: number) {
    // Google Docs, Sheets, and Slides cannot be downloaded as binary media
    const isGoogleDoc = file.mime_type?.startsWith("application/vnd.google-apps.");
    const isActuallyDownloadable = !isGoogleDoc || file.mime_type === "application/vnd.google-apps.folder";
    
    if (isGoogleDoc && file.mime_type !== "application/vnd.google-apps.folder") {
      toast(`Google Docs/Sheets cannot be moved directly. Please export them manually.`, "error");
      return;
    }

    setMoving(true);
    const tid = toast(`Moving "${file.file_name}" to another account...`, "loading");

    try {
      // 1. Get a temporary access token for the SOURCE account to download directly
      const creds = localStorage.getItem("credentials");
      const tokenRes = await fetch(`/api/accounts/${file.account_index}/token`, {
        headers: {
          ...(creds ? { "X-Credentials": creds } : {})
        }
      });
      if (!tokenRes.ok) throw new Error("Failed to get source access token");
      const { accessToken } = await tokenRes.json();

      // 2. Download directly from Google to Browser (0 server bandwidth)
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
        {
          method: "GET",
          headers: { 
            Authorization: `Bearer ${accessToken}`,
          },
          mode: "cors",
        }
      );

      if (!downloadRes.ok) {
        const errorText = await downloadRes.text().catch(() => "Unknown error");
        console.error("[Move] Download failed:", downloadRes.status, errorText);
        
        if (downloadRes.status === 403 && errorText.includes("fileNotDownloadable")) {
           throw new Error("This file type cannot be downloaded directly (Google Doc).");
        }
        throw new Error(`Failed to download: Google returned ${downloadRes.status}`);
      }
      
      const blob = await downloadRes.blob();

      // 3. Upload to target account (0 server bandwidth via resumable upload)
      // Wrap the blob in a File object to preserve the filename and type
      const movedFile = new File([blob], file.file_name, { type: file.mime_type || "application/octet-stream" });
      await upload(movedFile, null, targetAccountIndex);

      // 4. Delete from source
      await fetch(`/api/files/${file.id}`, { 
        method: "DELETE", 
        headers: {
          ...(creds ? { "X-Credentials": creds } : {})
        }
      });

      updateToast(tid, "success", `Moved "${file.file_name}" successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[Move] Error:", err);
      updateToast(tid, "error", `Move failed: ${err.message}`);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-sd-text">Move to another account</h3>
        <p className="mt-2 text-sm text-sd-text3">
          The file will be downloaded to your device and then uploaded to the target account. 
          This process uses your internet connection.
        </p>

        <div className="mt-6 space-y-2">
          {otherAccounts.length === 0 ? (
            <p className="text-center py-4 text-sm text-sd-text3">No other connected accounts found.</p>
          ) : (
            otherAccounts.map((acc) => (
              <button
                key={acc.account_index}
                disabled={moving}
                onClick={() => handleMove(acc.account_index)}
                className="flex w-full items-center justify-between rounded-xl border border-sd-border bg-sd-bg px-4 py-3 transition hover:bg-sd-hover group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sd-accent/10 text-sd-accent">
                    <span className="text-xs font-bold">{acc.account_index}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-sd-text group-hover:text-sd-accent transition">{acc.email}</p>
                    <p className="text-[10px] text-sd-text3 uppercase tracking-wider font-bold">Target Storage</p>
                  </div>
                </div>
                <svg className="h-4 w-4 text-sd-text3 group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-sd-text2 hover:bg-sd-s2 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
