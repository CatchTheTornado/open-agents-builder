import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { DatabaseAuthorizeChallengeRequestDTO, DatabaseAuthorizeRequestDTO, DatabaseCreateRequestDTO, DatabaseRefreshRequestDTO, KeyACLDTO, KeyHashParamsDTO, SaaSDTO } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";

export type CreateDbResponse = {
  message: string;
  data: {
    databaseIdHash: string;
    saasContext?: SaaSDTO | null
  }
  status: number;
  issues?: any[];
};
export type AuthorizeDbChallengeResponse = {
  message: string;
  data?: KeyHashParamsDTO,
  status: number;
  issues?: any[];
};

export type AuthorizeDbResponse = {
  message: string;
  data: {
    encryptedMasterKey: string;
    accessToken: string;
    refreshToken: string;
    acl: KeyACLDTO | null;
    saasContext?: SaaSDTO | null
  }
  status: number;
  issues?: any[];
};

export type RefreshDbResponse = {
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
  }
  status: number;
  issues?: any[];
};

export class DbApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }
  
    async create(createRequest:DatabaseCreateRequestDTO): Promise<CreateDbResponse> {
      return this.request<CreateDbResponse>('/api/db/create', 'POST', { encryptedFields: [] }, createRequest) as Promise<CreateDbResponse>;
    }
  
    async authorizeChallenge(authorizeChallengeRequest: DatabaseAuthorizeChallengeRequestDTO): Promise<AuthorizeDbChallengeResponse> {
       return this.request<AuthorizeDbChallengeResponse>('/api/db/challenge?databaseIdHash=' + encodeURIComponent(authorizeChallengeRequest.databaseIdHash), 'POST', { encryptedFields: [] }, authorizeChallengeRequest) as Promise<AuthorizeDbChallengeResponse>;
    }

    async authorize(authorizeRequest: DatabaseAuthorizeRequestDTO): Promise<AuthorizeDbResponse> {
      return this.request<AuthorizeDbResponse>('/api/db/authorize?databaseIdHash=' + encodeURIComponent(authorizeRequest.databaseIdHash), 'POST', { encryptedFields: [] }, authorizeRequest) as Promise<AuthorizeDbResponse>;
   }

   async refresh(refreshRequest: DatabaseRefreshRequestDTO): Promise<RefreshDbResponse> {
    return this.request<AuthorizeDbResponse>('/api/db/refresh', 'POST', { encryptedFields: [] }, refreshRequest) as Promise<AuthorizeDbResponse>;
 }   

  }