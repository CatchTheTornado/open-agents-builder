import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";
import { ResultDTO, ResultDTOEncSettings } from "../dto";
import { DatabaseContextType } from "@/contexts/db-context";

export type GetResultsResponse = ResultDTO[];
export type PutResultRequest = ResultDTO;

export type PutResultResponseSuccess = {
  message: string;
  data: ResultDTO;
  status: 200;
};

export type DeleteResultResponse = {
  message: string;
  status: 200;
};

export type PutResultResponseError = {
  message: string;
  status: 400;
  issues?: any[];
};

export type PutResultResponse = PutResultResponseSuccess | PutResultResponseError;


export class ResultApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }

    async get(sessionId?:string, agentId?: string): Promise<GetResultsResponse> {
    if (sessionId)
      return this.request<GetResultsResponse>('/api/result/?id=' + encodeURIComponent(sessionId) , 'GET', ResultDTOEncSettings) as Promise<GetResultsResponse>;
    if (agentId)
      return this.request<GetResultsResponse>('/api/result/?agentId=' + encodeURIComponent(agentId) , 'GET', ResultDTOEncSettings) as Promise<GetResultsResponse>;
    else 
      return this.request<GetResultsResponse>('/api/result' , 'GET', ResultDTOEncSettings) as Promise<GetResultsResponse>;
    }

    async export(agentId: string): Promise<any> {
      return this.getArrayBuffer('/api/agent/' + encodeURIComponent(agentId) + '/result/export') as Promise<any>;
    }
    
    async put(record: PutResultRequest): Promise<PutResultResponse> {
      return this.request<PutResultResponse>('/api/result', 'PUT', ResultDTOEncSettings, record) as Promise<PutResultResponse>;
    }

    async delete(record: ResultDTO): Promise<DeleteResultResponse> {
      return this.request<DeleteResultResponse>('/api/result/' + record.sessionId, 'DELETE', { encryptedFields: [] }) as Promise<DeleteResultResponse>;
    }    
}