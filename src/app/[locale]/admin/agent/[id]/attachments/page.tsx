"use client";

import { useContext, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NoRecordsAlert } from "@/components/shared/no-records-alert";
import InfiniteScroll from "@/components/infinite-scroll";
import { CopyIcon, FileWarningIcon, HourglassIcon, ImportIcon, Loader2, ShareIcon, TrashIcon, UploadIcon } from "lucide-react";

import { AttachmentDTO, PaginatedQuery, PaginatedResult } from "@/data/dto";
import { getErrorMessage, safeJsonParse } from "@/lib/utils";

import { useAttachmentContext } from "@/contexts/attachment-context";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";

import { AttachmentUploader } from "@/components/attachment-uploader";
import { Attachment } from "@/data/client/models";
import { ChatMessageMarkdown } from "@/components/chat-message-markdown";
import { useAgentContext } from "@/contexts/agent-context";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useCopyToClipboard } from "react-use";
import { Textarea } from "@/components/ui/textarea";
import JsonView from "@uiw/react-json-view";
import { useFilePicker } from "use-file-picker";

export default function FilesPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const agentContext = useAgentContext();
    const attachmentContext = useAttachmentContext();
    const dbContext = useContext(DatabaseContext);
    const saasContext = useContext(SaaSContext);   
    
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [previewContent, setPreviewContent] = useState<string>("");
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [, copy] = useCopyToClipboard();

    const { openFilePicker, filesContent, loading } = useFilePicker({
        accept: '.zip',
        readAs: 'ArrayBuffer',
        onFilesSuccessfullySelected: async () => {
          filesContent.map(async (fileContent) => {
            await attachmentContext.importAttachments(fileContent.content);
            toast(t('Attachments imported successfully'));
          });
        }
      });    

    const [queryParams, setQueryParams] = useState<PaginatedQuery>({
        limit: 6,
        offset: 0,
        query: "",
        orderBy: "createdAt",
    });
    const [debouncedQueryParams] = useDebounce(queryParams, 500);

    const [attachmentsData, setAttachmentsData] = useState<PaginatedResult<Attachment[]>>({
        rows: [],
        total: 0,
        limit: 6,
        offset: 0,
        orderBy: "createdAt",
        query: "",
    });

    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 6;

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            try {
                const response = await attachmentContext.queryAttachments({
                    limit: debouncedQueryParams.limit,
                    offset: 0,
                    orderBy: debouncedQueryParams.orderBy,
                    query: debouncedQueryParams.query,
                });
                setAttachmentsData({
                    ...response,
                    rows: response.rows.map((r) => Attachment.fromDTO(r)),
                });
                setHasMore(response.rows.length < response.total);
            } catch (error) {
                toast.error(getErrorMessage(error));
            }
            setIsLoading(false);
        })();
    }, [debouncedQueryParams, attachmentContext.refreshDataSync]);

    useEffect(() => {
        setHasMore(attachmentsData.offset + attachmentsData.limit < attachmentsData.total);
    }, [attachmentsData]);

    const loadMore = async () => {
        if (isLoading) return;
        const newOffset = attachmentsData.offset + attachmentsData.limit;
        if (newOffset >= attachmentsData.total) {
            setHasMore(false);
            return;
        }
        setIsLoading(true);

        try {
            const response = await attachmentContext.queryAttachments({
                limit: pageSize,
                offset: newOffset,
                orderBy: attachmentsData.orderBy,
                query: attachmentsData.query,
            });

            setAttachmentsData((prev) => ({
                rows: [...prev.rows, ...response.rows].map((r) => Attachment.fromDTO(r)),
                total: response.total,
                limit: prev.limit + response.limit,
                offset: newOffset,
                orderBy: prev.orderBy,
                query: prev.query,
            }));
            setHasMore(newOffset + response.limit < response.total);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
        setIsLoading(false);
    };

    const handleDelete = async (attachment: Attachment) => {
        if (!confirm(t("Are you sure you want to delete this attachment?") || "")) {
            return;
        }
        await attachmentContext.deleteAttachment(attachment.toDTO());
        setAttachmentsData((prev) => ({
            ...prev,
            rows: prev.rows.filter((a) => a.storageKey !== attachment.storageKey),
            total: prev.total - 1,
        }));
    };

    return (
        <div className="space-y-6">
            <div>
                    <AttachmentUploader
                        dbContext={dbContext}
                        saasContext={saasContext}
                        onUploaded={(uploaded) => {
                            setAttachmentsData((prev) => ({
                                ...prev,
                                rows: [uploaded, ...prev.rows].map((r) => Attachment.fromDTO(r)),
                                total: prev.total + 1,
                            }));
                        }}
                    />

                <div className="text-xs p-2">
                {t('Supported file types: images, text files, ZIP archives, PDFs, Word documents, Excel spreadsheets, PowerPoint presentations. When uploading documents including text (PDF, Office, text, CSV, ZIP archives...) - files will be converted to Markdown and available in the Flows and for other AI tools. ')}
                </div>
            </div>


        {attachmentsData.rows.length > 0 && (
        <Button className="mr-2" size="sm" variant="outline" onClick={() => {
          try {
            attachmentContext.exportAttachments();
          } catch (e) {
            console.error(e);
            toast.error(t(getErrorMessage(e)));
          }
        }}><ShareIcon className='w-4 h-4' /> {t('Export attachments ...')}</Button>
      )}

        <Button size="sm" variant="outline" onClick={openFilePicker} disabled={loading}>
          <ImportIcon className="w-4 h-4 mr-2" />
          {t("Import attachments ...")}
        </Button>      

            <Input
                placeholder={t("Search attachments...") || ""}
                onChange={(e) =>
                    setQueryParams((prev) => ({
                        ...prev,
                        query: e.target.value,
                    }))
                }
                value={queryParams.query}
            />

            {attachmentsData.rows.length === 0 && !isLoading && (
                <NoRecordsAlert title={t("No attachments found")}>
                    {t("Try adjusting your search or upload new files.")}
                </NoRecordsAlert>
            )}
            <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                <DialogContent className="p-4 max-w-3xl">
                <h3 className="text-sm font-bold">{t('File content preview')}:</h3>
                <div className="flex scrollbar overflow-y-auto h-96">
                    {attachment?.mimeType === "application/json" ? (
                        <JsonView value={safeJsonParse(previewContent, {})} />
                        ) : (
                    <ChatMessageMarkdown>{previewContent}</ChatMessageMarkdown>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" size={"sm"} onClick={() => {
                        copy(previewContent);
                        toast.success(t('File content has been copied to clipboard'));
                    }}>
                    <CopyIcon className="w-4 h-4 mr-2" />
                    </Button>

                    <Button onClick={() => setPreviewDialogOpen(false)}>{t('Close')}</Button>
                </DialogFooter>

                </DialogContent>
            </Dialog>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {attachmentsData.rows.map((attachment) => (
                    <Card key={attachment.storageKey}>
                        <CardHeader>
                            <CardTitle className="text-sm">
                                {attachment.displayName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs">
                            <p><span className="font-bold">{t('Type')}:</span> {attachment.mimeType}</p>
                            {((!attachment.content && !attachment.extra?.status && !attachment.extra?.error && !attachment.mimeType?.startsWith('image')) || attachment.extra && attachment.extra.status === "extracting") && (
                                <p className="text-xs h-40 p-4 border bg-white shadow-sm border-gray-200 rounded mt-2 items-center text-orange-500 flex p-4 text-center justify-center"><HourglassIcon className="mr-2 w-4 h-4" /> {t("Extracting content...")}</p>
                            )}
                            {attachment.extra && attachment.extra.status === "error" && (
                                <p className="text-xs h-40 p-4 border bg-white shadow-sm border-gray-200 rounded mt-2 text-red-500 flex p-4 text-center justify-center"><FileWarningIcon className="mr-2 w-4 h-4" /> {t("Extracting content error")}: {attachment.extra.error}</p>
                            )}

                            {attachment.mimeType?.startsWith("image") && (
                                <img
                                    src={`/storage/attachment/${dbContext?.databaseIdHash}/${attachment.storageKey}`}
                                    alt={attachment.displayName}
                                    className="my-2 max-h-40 object-cover"
                                />
                            )}
                            {attachment.content && (                 
                                <div onClick={() => {
                                    setAttachment(attachment);
                                    setPreviewContent(attachment.content);
                                    setPreviewDialogOpen(true);
                                }}>
                                <ChatMessageMarkdown className="cursor-pointer text-xs h-40 p-4 border bg-white text-gray-500 shadow-sm border-gray-200 rounded mt-2 overflow-hidden">
                                    {attachment.content.length > 100 ? `${attachment.content.substring(0, 100)}...` : attachment.content}
                                </ChatMessageMarkdown>
                                </div>               
                            )}
                            <div className="flex justify-end mt-4">
                                <Button variant={"default"} size="sm" className="mr-2" onClick={() => {
                                       const a = document.createElement('a');
                                       a.href = `/storage/attachment/${dbContext?.databaseIdHash}/${attachment.storageKey}`;
                                       a.download = attachment.displayName;
                                       a.click(); 
                                }}>
                                   {t("Download")}
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(attachment)}
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <InfiniteScroll
                hasMore={hasMore}
                isLoading={isLoading}
                next={loadMore}
                threshold={1}
            >
                {hasMore && (
                    <div className="flex justify-center">
                        <Loader2 className="my-4 h-8 w-8 animate-spin" />
                    </div>
                )}
            </InfiniteScroll>
        </div>
    );
}
