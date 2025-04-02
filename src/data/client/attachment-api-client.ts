import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { AttachmentDTO, PaginatedResult } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { urlParamsForQuery } from "./base-api-client";

export type PutAttachmentRequest = FormData | AttachmentDTO;
export type GetAttachmentPaginatedResponse = PaginatedResult<AttachmentDTO[]>;


export type PutAttachmentResponseSuccess = {
  message: string;
  data: AttachmentDTO;
  status: 200;
};

export type DeleteAttachmentResponse = {
  message: string;
  status: 200;
};

export type PutAttachmentResponseError = {
  message: string;
  status: 400;
  issues?: any[];
};

export type PutAttachmentResponse = PutAttachmentResponseSuccess | PutAttachmentResponseError;

export class AttachmentApiClient extends AdminApiClient {
    storageSchema: string; 

    constructor(baseUrl: string, storageSchema: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
      this.storageSchema = storageSchema;
    }

  
    async put(inputObject:PutAttachmentRequest): Promise<PutAttachmentResponse> {
      if (inputObject instanceof FormData) {
        return this.request<PutAttachmentResponse>('/api/attachment', 'PUT', { encryptedFields: [] }, null, inputObject as FormData, undefined, {
          'Storage-Schema': this.storageSchema
        }) as Promise<PutAttachmentResponse>;
      } else {
        return this.request<PutAttachmentResponse>('/api/attachment', 'PUT', { encryptedFields: ['displayName'] }, inputObject as AttachmentDTO, undefined, undefined, {
          'Storage-Schema': this.storageSchema
        }) as Promise<PutAttachmentResponse>;
      }
    }

    async get(attachment: AttachmentDTO): Promise<ArrayBuffer | undefined | null> {
      return this.getArrayBuffer('/api/attachment/' + attachment.storageKey, undefined, {
        'Storage-Schema': this.storageSchema
      });
    }

    async delete(attachment: AttachmentDTO): Promise<DeleteAttachmentResponse> {
      return this.request<DeleteAttachmentResponse>('/api/attachment/' + attachment.storageKey, 'DELETE', { encryptedFields: [] }, undefined, undefined, undefined,
        {
          'Storage-Schema': this.storageSchema
        }
      ) as Promise<DeleteAttachmentResponse>;
    }

    async query(params: { limit: number; offset: number; orderBy?: string; query?: string; }): Promise<GetAttachmentPaginatedResponse> {
      const { limit, offset, orderBy, query } = params;
      const queryParams = urlParamsForQuery({ limit, offset, orderBy: orderBy || '', query: query || '' });
      return this.request<GetAttachmentPaginatedResponse>(
        `/api/attachment/query?${queryParams}`,
        "GET",
        { encryptedFields: [] },
        undefined,
        undefined,
        undefined,
        {
          'Storage-Schema': this.storageSchema
        }
      ) as Promise<GetAttachmentPaginatedResponse>;
    }    

    async export(): Promise<any> {
      return this.getArrayBuffer('/api/attachment/export') as Promise<any>;
    }    
    
  }