// ===== src/components/attachment-uploader.tsx =====
"use client";

import React, { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

import {
  Button,
} from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Loader2,
  CheckIcon,
  XIcon,
  TrashIcon,
  PaperclipIcon,
} from "lucide-react";

import { useTranslation } from "react-i18next";

import { AttachmentApiClient } from "@/data/client/attachment-api-client";
import { AttachmentDTO } from "@/data/dto";
import { getCurrentTS, getErrorMessage } from "@/lib/utils";
import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { useAttachmentContext } from "@/contexts/attachment-context";
import { guessType } from "@/flows/inputs";

export enum FileUploadStatus {
  QUEUED = "QUEUED",
  UPLOADING = "UPLOADING",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

export interface UploadedFile {
  id: string;
  file: File;
  status: FileUploadStatus;
  uploaded: boolean;
  dto: AttachmentDTO;
}

interface FileUploaderProps {
  dbContext?: DatabaseContextType | null;
  saasContext?: SaaSContextType | null;
  onUploaded?: (uploadedAttachment: AttachmentDTO) => void;
  accept?: string | undefined;
}

export function AttachmentUploader({
  dbContext,
  saasContext,
  accept,
  onUploaded,
}: FileUploaderProps) {
  const { t } = useTranslation();
  const attContext = useAttachmentContext();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------ helpers ------------------------------ */

  const enqueueSelectedFiles = useCallback(
    (files: FileList) => {
      const newFiles = Array.from(files)
        .map<UploadedFile>((file) => ({
          id: nanoid(),
          file,
          status: FileUploadStatus.QUEUED,
          uploaded: false,
          dto: {
            id: undefined,
            displayName: file.name,
            description: "",
            mimeType: file.type ?? guessType(file.name),
            size: file.size,
            storageKey: uuidv4(),
            createdAt: getCurrentTS(),
            updatedAt: getCurrentTS(),
          },
        }))
        .filter(
          (f) =>
            f.dto.mimeType === "" ||
            f.dto.mimeType.startsWith("image") ||
            f.dto.mimeType.startsWith("text") ||
            f.dto.mimeType.startsWith("application/json") ||
            f.dto.mimeType.startsWith("application/zip") ||
            f.dto.mimeType.startsWith("application/vnd.openxmlformats") ||
            f.dto.mimeType.startsWith("application/pdf")
        );

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach((f) => uploadFile(f));
    },
    []
  );

  /* ------------------------------ handlers ------------------------------ */

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        enqueueSelectedFiles(e.target.files);
        // reset so the same file can be chosen twice in a row
        e.target.value = "";
      }
    },
    [enqueueSelectedFiles]
  );

  const uploadFile = useCallback(
    async (fileToUpload: UploadedFile) => {
      fileToUpload.status = FileUploadStatus.UPLOADING;
      setUploadedFiles((prev) => [...prev]);

      try {
        const formData = new FormData();
        formData.append("file", fileToUpload.file);
        formData.append("attachmentDTO", JSON.stringify(fileToUpload.dto));

        const apiClient = new AttachmentApiClient("", "", dbContext, saasContext, {
          useEncryption: false,
        });

        const result = await apiClient.put(formData);

        if (result.status === 200) {
          fileToUpload.status = FileUploadStatus.SUCCESS;
          fileToUpload.uploaded = true;
          fileToUpload.dto = result.data;
          toast.success(t("File uploaded: ") + fileToUpload.dto.displayName);
          onUploaded?.(fileToUpload.dto);
        } else {
          toast.error(t("File upload error ") + result.message);
          fileToUpload.status = FileUploadStatus.ERROR;
        }
      } catch (error) {
        toast.error(t("File upload error ") + getErrorMessage(error));
        fileToUpload.status = FileUploadStatus.ERROR;
      } finally {
        setUploadedFiles((prev) => [...prev]);
      }
    },
    [dbContext, saasContext, onUploaded, t]
  );

  const removeFile = useCallback(
    (file: UploadedFile) => {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
      try {
        attContext.deleteAttachment(file.dto);
      } catch (e) {
        console.error("Error deleting attachment", e);
        toast.error(t("Error deleting attachment"));
      }
    },
    [attContext, t]
  );

  /* ------------------------------- render ------------------------------- */

  return (
    <div className="flex flex-col gap-2">
      {/* hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept={
          accept ??
          "image/*; text/*; application/json; application/zip; application/vnd.openxmlformats/*; application/pdf"
        }
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* uploaded file badges */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((uf) => (
            <div
              key={uf.id}
              className="flex items-center space-x-2 bg-muted p-2 rounded"
            >
              <span className="text-sm flex items-center">
                {uf.status === FileUploadStatus.UPLOADING && (
                  <Loader2 className="mr-1 w-4 h-4 animate-spin" />
                )}
                {uf.status === FileUploadStatus.SUCCESS && (
                  <CheckIcon className="mr-1 w-4 h-4 text-green-500" />
                )}
                {uf.status === FileUploadStatus.ERROR && (
                  <XIcon className="mr-1 w-4 h-4 text-red-500" />
                )}
                {uf.file.name}
              </span>

              {uf.status === FileUploadStatus.ERROR && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => uploadFile(uf)}
                >
                  {t("Retry")}
                </Button>
              )}

              <Button
                variant="ghost"
                type="button"
                onClick={() => removeFile(uf)}
              >
                <TrashIcon size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* paper‑clip button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center self-start text-xs"
      >
        <PaperclipIcon className="w-4 h-4" /> {t('Upload files')}
      </Button>
    </div>
  );
}
