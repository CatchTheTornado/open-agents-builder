// File: src/contexts/memory-context.tsx

"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  MemoryApiClient,
  MemoryQueryParams,
  MemoryListResponse,
  MemoryRecordsResponse,
} from "@/data/client/memory-api-client";
import { DatabaseContext } from "./db-context";
import { SaaSContext } from "./saas-context";
import { DataLoadingStatus } from "@/data/client/models";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { StorageSchemas } from "@/data/dto";

type MemoryContextType = {
  loaderStatus: DataLoadingStatus;

  // Existing methods
  queryFiles: (params: MemoryQueryParams) => Promise<MemoryListResponse>;
  getFileContent: (fileName: string) => Promise<string>;
  deleteFile: (fileName: string) => Promise<void>;

  // New method to get partial records or vector search results from a single file
  listRecords: (fileName: string, opts: {
    limit: number;
    offset: number;
    embeddingSearch?: string;
    topK?: number;
  }) => Promise<MemoryRecordsResponse>;

  // New method to create a store
  createStore: (storeName: string) => Promise<void>;

  // New method to save a record
  saveRecord: (fileName: string, record: {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    embedding: number[];
  }) => Promise<void>;

  // New method to delete a record
  deleteRecord: (fileName: string, recordId: string) => Promise<void>;

  // New method to generate embeddings
  generateEmbeddings: (content: string) => Promise<number[]>;
};

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider = ({ children }: { children: ReactNode }) => {
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);

  const [loaderStatus, setLoaderStatus] = useState<DataLoadingStatus>(DataLoadingStatus.Idle);

  /**
   * Initialize the API client with relevant schema, etc.
   */
  const setupApiClient = (): MemoryApiClient => {
    const storageSchema = StorageSchemas.VectorStore;
    return new MemoryApiClient(
      "", // baseUrl (if relative, keep empty)
      storageSchema,
      dbContext,
      saasContext,
      { useEncryption: false }
    );
  };

  const queryFiles = async (params: MemoryQueryParams): Promise<MemoryListResponse> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      const data = await apiClient.query(params);
      setLoaderStatus(DataLoadingStatus.Success);
      return data;
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  const getFileContent = async (fileName: string): Promise<string> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      const content = await apiClient.getFileContent(fileName);
      setLoaderStatus(DataLoadingStatus.Success);
      return content;
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  const deleteFile = async (fileName: string): Promise<void> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      const resp = await apiClient.deleteFile(fileName);
      if (resp.status === 404) {
        toast.error("Store not found");
        throw new Error("Store not found");
      }
      if (resp.status !== 200) {
        toast.error(resp.message || "Failed to delete store");
        throw new Error(resp.message || "Failed to delete store");
      }
      setLoaderStatus(DataLoadingStatus.Success);
      toast.success("Store deleted successfully");
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  /**
   * New method: list (or vector-search) a single file's records with server pagination.
   */
  const listRecords = async (
    fileName: string,
    opts: { limit: number; offset: number; embeddingSearch?: string; topK?: number }
  ): Promise<MemoryRecordsResponse> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      const resp = await apiClient.listRecords(fileName, opts);
      setLoaderStatus(DataLoadingStatus.Success);
      return resp;
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  /**
   * Create a new vector store with the given name
   */
  const createStore = async (storeName: string): Promise<void> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      await apiClient.createStore(storeName);
      setLoaderStatus(DataLoadingStatus.Success);
      toast.success("Store created successfully");
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  /**
   * Save a record to a vector store
   */
  const saveRecord = async (
    fileName: string,
    record: {
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding: number[];
    }
  ): Promise<void> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      await apiClient.saveRecord(fileName, record);
      setLoaderStatus(DataLoadingStatus.Success);
      toast.success("Record saved successfully");
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  /**
   * Delete a record from a vector store
   */
  const deleteRecord = async (fileName: string, recordId: string): Promise<void> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      await apiClient.deleteRecord(fileName, recordId);
      setLoaderStatus(DataLoadingStatus.Success);
      toast.success("Record deleted successfully");
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  /**
   * Generate embeddings for content
   */
  const generateEmbeddings = async (content: string): Promise<number[]> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const apiClient = setupApiClient();
      const embedding = await apiClient.generateEmbeddings(content);
      setLoaderStatus(DataLoadingStatus.Success);
      return embedding;
    } catch (error) {
      setLoaderStatus(DataLoadingStatus.Error);
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  const value: MemoryContextType = {
    loaderStatus,
    queryFiles,
    getFileContent,
    deleteFile,
    listRecords,
    createStore,
    saveRecord,
    deleteRecord,
    generateEmbeddings,
  };

  return (
    <MemoryContext.Provider value={value}>
      {children}
    </MemoryContext.Provider>
  );
};

export const useMemoryContext = (): MemoryContextType => {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error("useMemoryContext must be used within a MemoryProvider");
  }
  return context;
};
