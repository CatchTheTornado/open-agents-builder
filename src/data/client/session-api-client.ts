import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";
import { SessionDTO, SessionDTOEncSettings } from "../dto";
import { DatabaseContextType } from "@/contexts/db-context";

export type GetSessionsResponse = SessionDTO[];
export type PutSessionRequest = SessionDTO;

export type PutSessionResponseSuccess = {
  message: string;
  data: SessionDTO;
  status: 200;
};

export type DeleteSessionResponse = {
  message: string;
  status: 200;
};

export type PutSessionResponseError = {
  message: string;
  status: 400;
  issues?: any[];
};

export type PutSessionResponse = PutSessionResponseSuccess | PutSessionResponseError;


export class SessionApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }

    async get(sessionId?:string, agentId?: string): Promise<GetSessionsResponse> {
    if (sessionId)
      return this.request<GetSessionsResponse>('/api/session/?id=' + encodeURIComponent(sessionId) , 'GET', SessionDTOEncSettings) as Promise<GetSessionsResponse>;
    if (agentId)
      return this.request<GetSessionsResponse>('/api/session/?agentId=' + encodeURIComponent(agentId) , 'GET', SessionDTOEncSettings) as Promise<GetSessionsResponse>;
    else 
      return this.request<GetSessionsResponse>('/api/session' , 'GET', SessionDTOEncSettings) as Promise<GetSessionsResponse>;
    }
    
    async put(record: PutSessionRequest): Promise<PutSessionResponse> {
      return this.request<PutSessionResponse>('/api/session', 'PUT', SessionDTOEncSettings, record) as Promise<PutSessionResponse>;
    }

    async delete(record: SessionDTO): Promise<DeleteSessionResponse> {
      return this.request<DeleteSessionResponse>('/api/session/' + record.id, 'DELETE', { encryptedFields: [] }) as Promise<DeleteSessionResponse>;
    }    
}