"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, TrashIcon, Plus } from "lucide-react";
import { NoRecordsAlert } from "@/components/shared/no-records-alert";
import { useMemoryContext } from "@/contexts/memory-context";
import { getErrorMessage } from "@/lib/utils";
import { nanoid } from "nanoid";

// For table display
type PreviewRecord = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embeddingPreview?: number[];
  similarity?: number;
  sessionId?: string;
  expiry?: string;
};

// For file listing
type MemoryFile = {
  file: string;
  displayName: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  lastAccessed?: string;
};

// Add new types for record management
type RecordFormData = {
  content: string;
  metadata: string;
};

/**
 * Extended Admin page for Memory:
 * 1. Lists files with item counts and metadata.
 * 2. Clicking "View Records" opens a dialog that shows records in a table (paginated or vector search).
 * 3. Shows a loader/spinner when records are being fetched.
 * 4. Hitting 'Enter' in the vector search input triggers the search automatically.
 */
export default function MemoryFilesPage() {
  const { t } = useTranslation();
  const memoryContext = useMemoryContext();

  // Create store dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Searching the list of files
  const [query, setQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Pagination for the file listing
  const [limit] = useState(6);
  const [offset, setOffset] = useState(0);

  // The array of files with metadata
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // For record preview
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [records, setRecords] = useState<PreviewRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);

  // Effect to reload files when dialog closes
  useEffect(() => {
    if (!previewDialogOpen && selectedFileName) {
      // Reload the files to get updated counts
      loadFiles(true);
    }
  }, [previewDialogOpen]);

  // Basic pagination or topK for the records preview
  const [recordOffset, setRecordOffset] = useState(0);
  const recordPageSize = 5;

  // If using vector search, we store a "searchQuery"
  const [recordSearchQuery, setRecordSearchQuery] = useState("");

  // We track whether we are in "vector search mode"
  const [isVectorSearchMode, setIsVectorSearchMode] = useState(false);

  // Separate loading state for the records table in the dialog
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);

  // Add state for record management
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PreviewRecord | null>(null);
  const [recordFormData, setRecordFormData] = useState<RecordFormData>({
    content: "",
    metadata: "{}"
  });
  const [isSaving, setIsSaving] = useState(false);

  // ---------- Searching the file list with a debounce ----------
  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timerId = setTimeout(() => {
      setOffset(0);
      loadFiles(true);
    }, 400);
    setDebounceTimer(timerId);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [query]);

  /**
   * Load the list of memory files.
   */
  async function loadFiles(reset?: boolean) {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const nextOffset = reset ? 0 : offset;
      const resp = await memoryContext.queryFiles({
        limit,
        offset: nextOffset,
        query,
      });

      const formattedFiles = resp.files.map(file => ({
        file: file.file,
        displayName: file.displayName,
        itemCount: file.itemCount,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        lastAccessed: file.lastAccessed
      }));

      if (reset) {
        setFiles(formattedFiles);
      } else {
        setFiles(prev => [...prev, ...formattedFiles]);
      }
      setOffset(nextOffset + limit);
      setHasMore(resp.hasMore);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Load more files when scrolling
   */
  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    await loadFiles(false);
  };

  /**
   * Show the preview dialog for a specific file.
   * We initially load the first page of records from that file.
   */
  const handleShowDetails = async (fileName: string) => {
    setSelectedFileName(fileName);
    setRecords([]);
    setRecordsTotal(0);
    setRecordOffset(0);
    setRecordSearchQuery("");
    setIsVectorSearchMode(false);

    // Open the dialog
    setPreviewDialogOpen(true);

    // Then load the first page
    await loadRecords(fileName, 0, "");
  };

  /**
   * Delete an entire memory file from the server.
   */
  const handleDelete = async (fileName: string) => {
    if (!confirm(t("Are you sure you want to delete this file?") || "")) return;
    try {
      await memoryContext.deleteFile(fileName);
      await loadFiles(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // ---------- Loading records from the new route /[filename]/records ----------
  async function loadRecords(
    fileName: string,
    newOffset: number,
    vectorQuery: string,
    isAppend = false
  ) {
    setIsRecordsLoading(true);
    try {
      const result = await memoryContext.listRecords(fileName, {
        limit: recordPageSize,
        offset: newOffset,
        embeddingSearch: vectorQuery || undefined, // If empty, normal listing
        topK: recordPageSize,
      });
      if (isAppend) {
        setRecords((prev) => [...prev, ...result.rows]);
      } else {
        setRecords(result.rows);
      }
      setRecordsTotal(result.total);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRecordsLoading(false);
    }
  }

  /**
   * Handle normal pagination inside the preview dialog (no vector search).
   */
  const loadMoreRecords = async () => {
    if (isVectorSearchMode) return; // In vector mode, we do topK only
    const newOff = recordOffset + recordPageSize;
    if (newOff >= recordsTotal) return;
    setRecordOffset(newOff);
    // Append
    await loadRecords(selectedFileName, newOff, "", true);
  };

  /**
   * Trigger vector search inside the dialog (server side).
   * We'll reset offset to 0, run topK results, show them in the table.
   */
  const doVectorSearch = async () => {
    setRecordOffset(0);
    setIsVectorSearchMode(true);
    await loadRecords(selectedFileName, 0, recordSearchQuery, false);
  };

  /**
   * Reset out of vector search mode into normal list mode again.
   */
  const resetSearchMode = async () => {
    setRecordSearchQuery("");
    setIsVectorSearchMode(false);
    setRecordOffset(0);
    await loadRecords(selectedFileName, 0, "");
  };

  /**
   * Create a new vector store
   */
  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      toast.error(t("Please enter a store name"));
      return;
    }

    setIsCreating(true);
    try {
      await memoryContext.createStore(newStoreName);
      toast.success(t("Store created successfully"));
      setCreateDialogOpen(false);
      setNewStoreName("");
      // Refresh the list
      await loadFiles(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle saving a record (new or edit)
   */
  const handleSaveRecord = async () => {
    if (!selectedFileName) return;

    setIsSaving(true);
    try {
      const metadata = JSON.parse(recordFormData.metadata);
      const id = editingRecord?.id || nanoid();

      // Generate embeddings using the context method
      const embedding = await memoryContext.generateEmbeddings(recordFormData.content);

      const entry = {
        id,
        content: recordFormData.content,
        metadata,
        embedding
      };

      // Save using the memory context
      await memoryContext.saveRecord(selectedFileName, entry);

      // Refresh the records list
      await loadRecords(selectedFileName, recordOffset, recordSearchQuery, false);

      // Close the form
      setRecordFormOpen(false);
      setEditingRecord(null);
      setRecordFormData({ content: "", metadata: "{}" });

      toast.success(t("Record saved successfully"));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Handle specific error cases
      if (errorMessage.includes("Store not found")) {
        toast.error(t("Store not found. Please try refreshing the page."));
      } else if (errorMessage.includes("Missing required fields")) {
        toast.error(t("Please fill in all required fields."));
      } else {
        toast.error(getErrorMessage(error));
      }
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Open the record form for editing
   */
  const handleEditRecord = (record: PreviewRecord) => {
    setEditingRecord(record);
    setRecordFormData({
      content: record.content,
      metadata: JSON.stringify(record.metadata, null, 2)
    });
    setRecordFormOpen(true);
  };

  /**
   * Open the record form for new record
   */
  const handleNewRecord = () => {
    setEditingRecord(null);
    setRecordFormData({
      content: "",
      metadata: "{}"
    });
    setRecordFormOpen(true);
  };

  /**
   * Handle deleting a single record
   */
  const handleDeleteRecord = async (record: PreviewRecord) => {
    if (!confirm(t("Are you sure you want to delete this record?") || "")) return;
    
    setIsRecordsLoading(true);
    try {
      // Delete the record using the memory context
      await memoryContext.deleteRecord(selectedFileName, record.id);
      
      // Refresh the records list
      await loadRecords(selectedFileName, recordOffset, recordSearchQuery, false);
      
      toast.success(t("Record deleted successfully"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRecordsLoading(false);
    }
  };

  // ---------- RENDER ----------
  return (
    <div className="container mx-auto pt-1.5 pb-10">
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setCreateDialogOpen(true)} className="text-xs">
          <Plus className="h-4 w-4 mr-2" />
          {t("Create Store")}
        </Button>
        <Input
          type="search"
          placeholder={t("Search files...") || ""}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Create Store Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create New Vector Store")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={t("Enter store name...") || ""}
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateStore();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreateStore} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {files.length === 0 && !isLoading ? (
        <NoRecordsAlert 
          title={t("No files found")}
        >
          {t("Try adjusting your search or create a new file.")}
        </NoRecordsAlert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {files.map((file) => (
            <Card key={file.file} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{file.displayName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {file.itemCount !== undefined
                        ? t("{{count}} records", { count: file.itemCount })
                        : t("Unknown count")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file.file)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    {t("Created")}: {new Date(file.createdAt).toLocaleString()}
                  </p>
                  <p>
                    {t("Updated")}: {new Date(file.updatedAt).toLocaleString()}
                  </p>
                  {file.lastAccessed && (
                    <p>
                      {t("Last accessed")}: {new Date(file.lastAccessed).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleShowDetails(file.file)}
                  >
                    {t("View Records")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasMore && (
            <div className="flex justify-center col-span-full">
              <Button variant="ghost" onClick={loadMore} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("Load More")
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Show records from a single file in a table with pagination / vector search */}
      {previewDialogOpen && (
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="p-4 max-w-5xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold">
                {t("Memory File")}: {selectedFileName}
              </h3>
              <Button onClick={handleNewRecord} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("New Record")}
              </Button>
            </div>

            <div className="mb-4 flex items-center gap-2">
              {isVectorSearchMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={resetSearchMode}>
                    {t("Back to normal listing")}
                  </Button>
                  <div className="text-xs text-gray-500">
                    {t("Showing topK vector matches only.")}
                  </div>
                </>
              ) : (
                <>
                  <Input
                    className="text-sm"
                    placeholder={t("Enter a vector search query...") || ""}
                    value={recordSearchQuery}
                    onChange={(e) => setRecordSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        doVectorSearch();
                      }
                    }}
                  />
                  <Button variant="default" size="sm" onClick={doVectorSearch}>
                    {t("Vector Search")}
                  </Button>
                </>
              )}
            </div>

            {/* Loader for records */}
            {isRecordsLoading && (
              <div className="flex items-center justify-center my-2">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">{t("Loading records...")}</span>
              </div>
            )}

            {/* Table of records */}
            <div className="overflow-auto max-h-96 border p-2 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2 text-left">{t("ID")}</th>
                    <th className="p-2 text-left">{t("Session ID")}</th>
                    <th className="p-2 text-left">{t("Expiry Date")}</th>
                    <th className="p-2 text-left">{t("Metadata")}</th>
                    <th className="p-2 text-left">{t("Content")}</th>
                    <th className="p-2 text-left">{t("Similarity")}</th>
                    <th className="p-2 text-left">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records?.map((r) => {
                    const metadata = r.metadata as Record<string, unknown>;
                    const expiryDate = r.expiry as string | undefined;
                    const sessionId = r.sessionId as string | undefined;
                    const isExpired = expiryDate && new Date(expiryDate) < new Date();
                    const hasExpiry = !!expiryDate;
                    
                    return (
                      <tr key={r.id} className={`border-b ${isExpired ? 'text-red-600' : hasExpiry ? 'text-orange-600' : ''}`}>
                        <td className="p-2 align-top w-24 font-bold">{r.id}</td>
                        <td className="p-2 align-top">{sessionId || '-'}</td>
                        <td className="p-2 align-top">
                          {expiryDate ? new Date(expiryDate).toLocaleString() : '-'}
                        </td>
                        <td className="p-2 align-top">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(metadata ?? {}, null, 2)}
                          </pre>
                        </td>
                        <td className="p-2 align-top">
                          {r.content?.length > 100
                            ? r.content.slice(0, 100) + "…"
                            : r.content}
                        </td>
                        <td className="p-2 align-top">
                          {r.similarity ? r.similarity.toFixed(3) : ""}
                        </td>
                        <td className="p-2 align-top space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRecord(r)}
                          >
                            {t("Edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteRecord(r)}
                            disabled={isRecordsLoading}
                          >
                            <TrashIcon className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Load more if in normal mode (no vector search) */}
            {!isVectorSearchMode && !isRecordsLoading && recordOffset + recordPageSize < recordsTotal && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm" onClick={loadMoreRecords}>
                  {t("Load more")}
                </Button>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button onClick={() => setPreviewDialogOpen(false)}>
                {t("Close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Form Dialog */}
      <Dialog open={recordFormOpen} onOpenChange={setRecordFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? t("Edit Record") : t("New Record")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("Content")}
              </label>
              <textarea
                className="w-full h-32 p-2 border rounded"
                value={recordFormData.content}
                onChange={(e) => setRecordFormData(prev => ({
                  ...prev,
                  content: e.target.value
                }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("Metadata (JSON)")}
              </label>
              <textarea
                className="w-full h-32 p-2 border rounded font-mono text-sm"
                value={recordFormData.metadata}
                onChange={(e) => setRecordFormData(prev => ({
                  ...prev,
                  metadata: e.target.value
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordFormOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveRecord} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
