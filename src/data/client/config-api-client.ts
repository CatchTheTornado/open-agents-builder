import { DatabaseContextType } from "@/contexts/db-context";
import { ConfigDTO, ConfigDTOEncSettings } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";

export type PutConfigRequest = ConfigDTO;

export type PutConfigResponseSuccess = {
  message: string;
  data: ConfigDTO;
  status: 200;
};

export type PutConfigResponseError = {
  message: string;
  status: 400;
  issues?: any[];
};

export type PutConfigResponse = PutConfigResponseSuccess | PutConfigResponseError;

export class ConfigApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }
  
    async get(): Promise<ConfigDTO[]> {
      return this.request<ConfigDTO[]>('/api/config', 'GET', ConfigDTOEncSettings) as Promise<ConfigDTO[]>;
    }
  
    async put(config: PutConfigRequest): Promise<PutConfigResponse> {
      return this.request<PutConfigResponse>('/api/config', 'PUT', ConfigDTOEncSettings, config) as Promise<PutConfigResponse>;
    }
  }