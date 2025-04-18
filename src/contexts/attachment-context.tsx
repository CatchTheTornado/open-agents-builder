"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { DatabaseContext } from "./db-context";
import { SaaSContext } from "./saas-context";
import { Attachment, DataLoadingStatus } from "@/data/client/models";
import { AttachmentApiClient } from "@/data/client/attachment-api-client";
import { AttachmentDTO, PaginatedQuery, PaginatedResult, StorageSchemas } from "@/data/dto";
import { getCurrentTS, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";

let syncHandler = null;

type AttachmentContextType = {
  loaderStatus: DataLoadingStatus;
  refreshDataSync: string;

  queryAttachments: (params: PaginatedQuery) => Promise<PaginatedResult<AttachmentDTO[]>>;
  deleteAttachment: (attachment: AttachmentDTO) => Promise<void>;

  exportAttachments: () => Promise<void>;
  importAttachments: (zipFileInput: ArrayBuffer) => Promise<void>;
};

const AttachmentContext = createContext<AttachmentContextType | undefined>(undefined);

export const AttachmentProvider = ({ children }: { children: ReactNode }) => {
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);

  const { t } = useTranslation();

  const [refreshDataSync, setRefreshDataSync] = useState<string>("");
  const [loaderStatus, setLoaderStatus] = useState<DataLoadingStatus>(DataLoadingStatus.Idle);

  const setupApiClient = (): AttachmentApiClient => {
    // Return an instance of AttachmentApiClient
    // If needed, you can set encryptionConfig
    return new AttachmentApiClient("", "", dbContext, saasContext, {
      useEncryption: false,
    });
  };

  const queryAttachments = async (params: PaginatedQuery): Promise<PaginatedResult<AttachmentDTO[]>> => {
    setLoaderStatus(DataLoadingStatus.Loading);
    try {
      const client = await setupApiClient();
      const response = await client.query(params);

      setLoaderStatus(DataLoadingStatus.Success);

      if (syncHandler) clearInterval(syncHandler);
      syncHandler = setInterval(() => {
        console.log('Refreshing SaaS data sync ...');
        setRefreshDataSync(new Date().toISOString());
      }, 1000 * 30); // refresh data every 30s

      return {
        ...response,
        rows: response.rows.map((r: any) => Attachment.fromDTO(r))
      }

    } catch (error) {
      console.error(error);
      setLoaderStatus(DataLoadingStatus.Error);
      throw error;
    }
  };

  const deleteAttachment = async (attachment: AttachmentDTO) => {
    try {
      const client = setupApiClient();
      const resp = await client.delete(attachment);
      if (resp.status === 200) {
        setRefreshDataSync(new Date().toISOString());
        toast.success(t("Attachment removed"));
      } else {
        toast.error(resp.message);
        console.error("deleteAttachment error:", resp);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      console.error("deleteAttachment error:", error);
    }
  };

  const exportAttachments = async () => {
    const apiClient = new AttachmentApiClient('', StorageSchemas.Default, dbContext, saasContext);
    const a = document.createElement('a');
    const file = new Blob([await apiClient.export() ?? ''], { type: 'application/zip' });
    a.href = URL.createObjectURL(file);
    a.download = `attachments.zip`;
    a.click();
  }

  const importAttachments = async (zipFileInput: ArrayBuffer) => {
    const zip = new JSZip();
    const zipFile = await zip.loadAsync(zipFileInput);
    const dataFile = zipFile.file("attachments.json");
    if (!dataFile) return;
    const rawData = await dataFile.async("string");
    const attachments = JSON.parse(rawData);

    try {
      for (const att of (attachments as AttachmentDTO[]).map((p) => Attachment.fromDTO(p))) {
        try {
          const uploadedAttachments: AttachmentDTO[] = [];

          const attFile = zipFile.file(att.displayName);
          if (attFile) {
            const fileContent = await attFile.async("arraybuffer");

            try {
              const apiClient = new AttachmentApiClient('', StorageSchemas.Default, dbContext, saasContext, {
                useEncryption: false  // for FormData we're encrypting records by ourselves - above
              })
              toast.info('Uploading attachment: ' + att.displayName);

              const file = new File([fileContent], att.displayName ? att.displayName : `${att.storageKey}`, { type: att.mimeType });
              const formData = new FormData();

              const attachmentDTO: AttachmentDTO = {

                id: att.id ? att.id : undefined,
                displayName: file.name,
                description: '',

                mimeType: att.mimeType,
                size: file.size,

                createdAt: getCurrentTS(),
                updatedAt: getCurrentTS(),

                storageKey: att.storageKey ? att.storageKey : uuidv4(),
              };

              formData.append("file", file); // TODO: encrypt file here
              formData.append("attachmentDTO", JSON.stringify(attachmentDTO));

              const result = await apiClient.put(formData);
              if (result.status === 200) {
                const uploadedAtt = result.data as AttachmentDTO;
                console.log('Attachment saved', uploadedAtt);
                uploadedAttachments.push(uploadedAtt);
              } else {
                console.error('Error saving attachment', result);
                toast.error(t('Error saving attachment: ') + result.message);
              }
            } catch (error) {
              console.error(error);
              toast.error('Error saving attachment: ' + error);
            }

            // upload fileContent here, then push new info to newImages
          }


        } catch (error) {
          console.error('Error importing attachment', att, error);
          toast.error(t('Error importing attachment: ') + att.storageKey);
        }
      }
    } catch (error) {
      console.error('Error importing attachment', error);
      toast.error(t('Error importing attachment. Check the file format.'));
    }

  }


  const value: AttachmentContextType = {
    loaderStatus,
    refreshDataSync,
    queryAttachments,
    deleteAttachment,
    exportAttachments,
    importAttachments
  };

  return <AttachmentContext.Provider value={value}>{children}</AttachmentContext.Provider>;
};

export const useAttachmentContext = (): AttachmentContextType => {
  const context = useContext(AttachmentContext);
  if (!context) {
    throw new Error("useAttachmentContext must be used within an AttachmentProvider");
  }
  return context;
};
