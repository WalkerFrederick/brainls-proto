"use client";

import { useState, useRef, useCallback } from "react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { checkStorageAvailable } from "@/actions/storage";
import type { AppFileRouter } from "@/lib/uploadthing";

interface UseFileUploadOptions<T extends keyof AppFileRouter> {
  route: T;
  maxFileBytes?: number;
  acceptedTypes?: string[];
  onSuccess?: (files: { name: string; url: string; key: string }[]) => void;
}

export function useFileUpload<T extends keyof AppFileRouter>({
  route,
  maxFileBytes,
  acceptedTypes,
  onSuccess,
}: UseFileUploadOptions<T>) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing(route, {
    onUploadError: () => {
      setError("Upload failed. Please try again.");
      setUploading(false);
    },
  });

  const clearError = useCallback(() => setError(""), []);

  const resetInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const openPicker = useCallback(() => {
    clearError();
    inputRef.current?.click();
  }, [clearError]);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError("");

      if (acceptedTypes) {
        const rejected = files.find((f) => !acceptedTypes.includes(f.type));
        if (rejected) {
          setError(`File type "${rejected.type}" is not supported.`);
          return;
        }
      }

      if (maxFileBytes) {
        const tooBig = files.find((f) => f.size > maxFileBytes);
        if (tooBig) {
          const limitMB = (maxFileBytes / (1024 * 1024)).toFixed(0);
          setError(`"${tooBig.name}" exceeds the ${limitMB} MB limit.`);
          return;
        }
      }

      setUploading(true);

      const storageCheck = await checkStorageAvailable();
      if (!storageCheck.success) {
        setError(storageCheck.error);
        setUploading(false);
        resetInput();
        return;
      }

      const result = await startUpload(files);

      if (result) {
        onSuccess?.(result.map((f) => ({ name: f.name, url: f.ufsUrl, key: f.key })));
      }

      setUploading(false);
      resetInput();
    },
    [startUpload, onSuccess, acceptedTypes, maxFileBytes, resetInput],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      upload(Array.from(e.target.files ?? []));
    },
    [upload],
  );

  return {
    uploading,
    error,
    clearError,
    inputRef,
    openPicker,
    upload,
    handleInputChange,
  };
}
