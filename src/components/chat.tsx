"use client"

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import remarkGfm from "remark-gfm";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import styles from "./chat.module.css";
import { ChatMessages, DisplayToolResultsMode } from "./chat-messages";
import { PaperclipIcon } from "./icons";
import { TrashIcon, Loader2, CheckIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

import { ExecApiClient } from "@/data/client/exec-api-client";
import { AttachmentDTO } from "@/data/dto";
import { getCurrentTS, getErrorMessage } from "@/lib/utils";
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

export interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

interface ChatProps {
  headers?: Record<string, string>;
  displayName?: string;
  welcomeMessage?: string;
  handleInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  messages: any[];
  isLoading?: boolean;
  isReadonly?: boolean;
  handleSubmit?: (
    e: React.FormEvent<HTMLFormElement>,
    options?: {
      headers: Record<string, string>;
      experimental_attachments: Attachment[];
    }
  ) => void;
  input?: string;
  databaseIdHash: string;
  sessionId: string;
  displayToolResultsMode?: DisplayToolResultsMode;
}

export function Chat({
  headers,
  welcomeMessage,
  displayName,
  messages,
  handleInputChange,
  isReadonly,
  isLoading,
  handleSubmit,
  input,
  databaseIdHash,
  sessionId,
  displayToolResultsMode
}: ChatProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const uploadFile = useCallback(
    async (fileToUpload: UploadedFile) => {
      fileToUpload.status = FileUploadStatus.UPLOADING;
      setUploadedFiles((prev) => [...prev]);

      try {
        const formData = new FormData();
        formData.append("file", fileToUpload.file);
        formData.append("attachmentDTO", JSON.stringify(fileToUpload.dto));

        const apiClient = new ExecApiClient(databaseIdHash ?? "");
        const result = await apiClient.upload(formData);

        if (result.status === 200) {
          fileToUpload.status = FileUploadStatus.SUCCESS;
          fileToUpload.uploaded = true;
          fileToUpload.dto = result.data;
          toast.success(t("File uploaded: ") + fileToUpload.dto.displayName);
        } else {
          fileToUpload.status = FileUploadStatus.ERROR;
          toast.error(t("File upload error ") + result.message);
        }
      } catch (error) {
        fileToUpload.status = FileUploadStatus.ERROR;
        toast.error(t("File upload error ") + getErrorMessage(error));
      } finally {
        setUploadedFiles((prev) => [...prev]);
      }
    },
    [databaseIdHash, t]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return;

      const selectedFiles = Array.from(event.target.files);
      const filtered = selectedFiles
        .map((file) => ({
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
          } as AttachmentDTO,
        }))
        .filter((f) => {
          const mt = f.dto.mimeType ?? "";
          return (
            mt === "" ||
            mt.startsWith("image") ||
            mt.startsWith("text") ||
            mt.startsWith("application/json") ||
            mt.startsWith("application/zip") ||
            mt.startsWith("application/vnd.openxmlformats") ||
            mt.startsWith("application/pdf")
          );
        });

      if (filtered.length === 0) return;

      setUploadedFiles((prev) => [...prev, ...filtered]);

      // trigger uploads
      filtered.forEach(uploadFile);

      // allow selecting the same file again by resetting the input
      event.target.value = "";
    },
    [uploadFile]
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const buildAttachmentsPayload = (): Attachment[] =>
    uploadedFiles
      .filter((f) => f.status === FileUploadStatus.SUCCESS)
      .map((f) => ({
        name: f.dto.displayName,
        contentType: f.dto.mimeType,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/storage/attachment/${databaseIdHash}/${f.dto.storageKey}`,
      }));

  return (
    <Card className="w-full max-w-2xl mx-auto border-none shadow-none">
      {displayName ? (
        <CardHeader>
          <CardTitle>{displayName}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        <ScrollArea className="h-[60vh] pr-4">
          {welcomeMessage ? (
            <div key="welcome-message" className={`mb-4 text-left`}>
              <span className={`inline-block p-2 rounded-lg bg-muted`}>
                <Markdown className={styles.markdown} remarkPlugins={[remarkGfm]}>
                  {welcomeMessage}
                </Markdown>
              </span>
            </div>
          ) : null}
          <ChatMessages messages={messages} displayTimestamps={false} sessionId={sessionId} databaseIdHash={databaseIdHash} displayToolResultsMode={displayToolResultsMode} />
          {isLoading && (
            <div className="text-left">
              <span className="inline-block p-2 rounded-lg bg-muted">
                {t("AI is typing...")}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form
          onSubmit={(event) => {
            const attachmentsPayload = buildAttachmentsPayload();

            if (handleSubmit)
              handleSubmit(event, {
                headers: headers ?? {},
                experimental_attachments: attachmentsPayload,
              });

            if (input) {
              // clear only after successful submit of text
              setUploadedFiles([]);

              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }
          }}
          className="flex flex-col w-full space-y-2"
        >
          {!isReadonly ? (
            <>
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((uf, index) => (
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
                        onClick={() => removeFile(index)}
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder={t("Type your message...")}
                  className="flex-grow"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center"
                >
                  <PaperclipIcon />
                </Button>
                <Input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  multiple
                  ref={fileInputRef}
                  accept="image/*; text/*; application/json; application/zip; application/vnd.openxmlformats/*; application/pdf"
                />
                <Button type="submit" disabled={isLoading}>
                  {t("Send")}
                </Button>
              </div>
            </>
          ) : null}
        </form>
      </CardFooter>
    </Card>
  );
}
