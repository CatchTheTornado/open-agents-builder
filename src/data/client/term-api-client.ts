import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { TermDTO } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { ZodIssue } from "zod";

export type PutTermRequest = TermDTO;

export type PutTermResponseSuccess = {
  message: string;
  data: TermDTO;
  status: 200;
};

export type PutTermResponseError = {
  message: string;
  status: 400;
  issues?: ZodIssue[];
};

export type PutTermResponse = PutTermResponseSuccess | PutTermResponseError;

export class TermApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }
  
    async get(): Promise<TermDTO[]> {
      return this.request<TermDTO[]>('/api/terms', 'GET', { encryptedFields: [] }) as Promise<TermDTO[]>;
    }
  
    async put(Term: PutTermRequest): Promise<PutTermResponse> {
      return this.request<PutTermResponse>('/api/terms', 'PUT', { encryptedFields: [] }, Term) as Promise<PutTermResponse>;
    }
    
    async delete(key: string): Promise<PutTermResponse> {
      return this.request<PutTermResponse>('/api/terms/' + key, 'DELETE', { encryptedFields: [] }) as Promise<PutTermResponse>;
    }    
  }