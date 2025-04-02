import { DatabaseContextType } from "@/contexts/db-context";
import { AuditDTO, ConfigDTO, ConfigDTOEncSettings, KeyDTO } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { ZodIssue } from "zod";
import { SaaSContextType } from "@/contexts/saas-context";

export type PutAuditRequest = AuditDTO;

export type PutAuditResponseSuccess = {
  message: string;
  data: AuditDTO;
  status: 200;
};

export type PutAuditResponseError = {
  message: string;
  status: 400;
  issues?: ZodIssue[];
};

export type PutAuditResponse = PutAuditResponseSuccess | PutAuditResponseError;

export class AuditApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }
  
    async get(limit: number, offset: number): Promise<AuditDTO[]> {
      if (limit <= 0) limit = 10;
      if (offset < 0) offset = 0;
      return this.request<AuditDTO[]>('/api/audit?limit=' + limit + '&offset=' + offset, 'GET', { encryptedFields: [] }) as Promise<AuditDTO[]>;
    }
  
    async put(key: PutAuditRequest): Promise<PutAuditResponse> {
      return this.request<PutAuditResponse>('/api/audit', 'PUT', { encryptedFields: [] }, key) as Promise<PutAuditResponse>;
    }
}