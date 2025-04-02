import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { ConfigDTO, ConfigDTOEncSettings, KeyDTO } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { ZodIssue } from "zod";

export type PutKeyRequest = KeyDTO;

export type PutKeyResponseSuccess = {
  message: string;
  data: KeyDTO;
  status: 200;
};

export type PutKeyResponseError = {
  message: string;
  status: 400;
  issues?: ZodIssue[];
};

export type PutKeyResponse = PutKeyResponseSuccess | PutKeyResponseError;

export class KeyApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }
  
    async get(): Promise<KeyDTO[]> {
      return this.request<KeyDTO[]>('/api/keys', 'GET', { encryptedFields: [] }) as Promise<KeyDTO[]>;
    }
  
    async put(key: PutKeyRequest): Promise<PutKeyResponse> {
      return this.request<PutKeyResponse>('/api/keys', 'PUT', { encryptedFields: [] }, key) as Promise<PutKeyResponse>;
    }
    
    async delete(keyLocatorHash: string): Promise<PutKeyResponse> {
      return this.request<PutKeyResponse>('/api/keys/' + keyLocatorHash, 'DELETE', { encryptedFields: [] }) as Promise<PutKeyResponse>;
    }    
  }