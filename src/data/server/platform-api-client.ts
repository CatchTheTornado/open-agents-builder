import { AdminApiClient } from "@/data/client/admin-api-client";
import { GetSaasResponse, SaaSActivationResponse } from "../client/saas-api-client";
import { StatDTO } from "../dto";


type UniversalApiResult = {
    status: number;
    data?: any;
    message?: string;
}

const qr = (databaseIdHash?: string|null, apiKey?: string|null) => {

    if (databaseIdHash) {
        return `?databaseIdHash=${encodeURIComponent(databaseIdHash)}`
    } else {
        if (apiKey) {
            return '?apiKey=' + encodeURIComponent(apiKey);
        }
    }

    return '';
}
export class PlatformApiClient extends AdminApiClient {
    apiKey: string;
    constructor(saasToken: string) {
        const saasPlatformUrl = process.env.SAAS_PLATFORM_URL || 'http://localhost:3001'
        super(saasPlatformUrl);
        this.apiKey = saasToken;
    }

    async activateAccount({ databaseIdHash, apiKey}:{
        databaseIdHash?: string|null;
        apiKey?: string|null;
    }): Promise<SaaSActivationResponse> {
        return this.request<SaaSActivationResponse>('/api/users/verify' + qr(databaseIdHash, apiKey), 'POST') as Promise<SaaSActivationResponse>;
    }

    async account({ databaseIdHash, apiKey}:{
        databaseIdHash?: string|null;
        apiKey?: string|null;
    }): Promise<GetSaasResponse> {
        return this.request<GetSaasResponse>('/api/users/me' + qr(databaseIdHash, apiKey), 'GET') as Promise<GetSaasResponse>;
    }

    async createAccount({ databaseIdHash, email, appId, language } : {
        databaseIdHash: string;
        email: string;
        appId: string;
        language: string;
    }):Promise<UniversalApiResult>  {
        return this.request<UniversalApiResult>('/api/users/create?apiKey=' + this.apiKey, 'POST', { encryptedFields: [] }, {
            databaseIdHash,
            email,
            appId,
            language
        }) as Promise<UniversalApiResult>;
    }

    async storeTerm(databaseIdHash:string, term: {
        content: string;
        name: string;
        email: string;
        signedAt: string,
        code: string
    }): Promise<UniversalApiResult> {
        return this.request<UniversalApiResult>('/api/terms' + qr(databaseIdHash, this.apiKey), 'POST', { encryptedFields: [] }, term) as Promise<UniversalApiResult>;
    }

    async saveEvent(databaseIdHash:string, event: {
        databaseIdHash: string;
        eventName: string;
        params?: any | null | undefined;
        createdAt?: Date | null | undefined;
    }): Promise<UniversalApiResult> {
        return this.request<UniversalApiResult>('/api/events' + qr(databaseIdHash, this.apiKey), 'POST', { encryptedFields: [] }, event) as Promise<UniversalApiResult>;
    }

    async saveStats(databaseIdHash:string, stat: StatDTO & {
        databaseIdHash: string;
    }): Promise<UniversalApiResult> {
        return this.request<UniversalApiResult>('/api/stats?databaseIdHash=' + encodeURIComponent(databaseIdHash), 'POST', { encryptedFields: [] }, stat) as Promise<UniversalApiResult>;
    }

    async newDatabase(dbData: {
        databaseIdHash: string;
        createdAt: string;
    }): Promise<UniversalApiResult> {
        return this.request<UniversalApiResult>('/api/db/new?apiKey=' + encodeURIComponent(this.apiKey), 'POST', { encryptedFields: [] }, dbData) as Promise<UniversalApiResult>;
    }

}
