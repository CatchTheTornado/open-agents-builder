import { BaseRepository } from "@/data/server/base-repository";
import { getErrorMessage, getZedErrorMessage } from "./utils";
import { ZodError } from "zod";
import { NextRequest, NextResponse, userAgent } from "next/server";
import { AuditDTO, auditDTOSchema, KeyACLDTO, SaaSDTO, StorageSchemas } from "@/data/dto";
import { PlatformApiClient } from "@/data/server/platform-api-client";
import NodeCache from "node-cache";
import { ApiError } from "@/data/client/base-api-client";
import { EncryptionUtils } from "./crypto";
import ServerAuditRepository from "@/data/server/server-audit-repository";

const saasCtxCache = new NodeCache({ stdTTL: 60 * 60 * 10 /* 10 min cache */});

export type ApiResult = {
    message: string;
    data?: any;
    error?: any
    issues?: any[];
    status: 200 | 400 | 500;
}

export type AuthorizedRequestContext = { 
    databaseIdHash: string;
    keyHash: string;
    keyLocatorHash: string;
    acl: KeyACLDTO;
    extra: any;
}

export type AuthorizedSaaSContext = {
    saasContex: SaaSDTO|null
    isSaasMode: boolean
    hasAccess: boolean;
    error?: string;
    apiClient: PlatformApiClient|null
}

export async function authorizeSaasContext(request: NextRequest, forceNoCache: boolean = false): Promise<AuthorizedSaaSContext> {
    const useCache = forceNoCache ? false : (request.nextUrl.searchParams.get('useCache') === 'false' ? false : true);
    const saasToken = request.headers.get('saas-token') !== null ? request.headers.get('saas-token') : request.nextUrl.searchParams.get('saasToken');
    const databaseIdHash = request.headers.get('database-id-hash') !== null ? request.headers.get('database-id-hash') : request.nextUrl.searchParams.get('databaseIdHash');
    return await authorizeSaasToken(databaseIdHash, saasToken, useCache);
}

export async function authorizeSaasToken(databaseIdHash?:string | null, saasToken?: string | null, useCache: boolean = false): Promise<AuthorizedSaaSContext> {
    if(!process.env.SAAS_PLATFORM_URL) {
        return {
            saasContex: null,
            hasAccess: true,
            isSaasMode: false,
            apiClient: null
        }
    } else {
        
        if (!saasToken && !databaseIdHash) {
             return {
                 saasContex: null,
                 isSaasMode: true,
                 hasAccess: false,
                 apiClient: null,
                 error: 'No SaaS Token / Database Id Hash provided. Please register your account / apply for beta tests on official landing page.'
            }            
        }
        const resp = useCache ? saasCtxCache.get(saasToken ?? '' + databaseIdHash) : null;
        if (!useCache) {
            console.log('Cache for SaasContext disabled');
        }
        if (resp) {
            return {
                ...resp,
                apiClient: new PlatformApiClient(saasToken ?? '')
            } as AuthorizedSaaSContext;
        } else {
            const client = new PlatformApiClient(saasToken ?? '');
            try {
                const response = await client.account({ databaseIdHash, apiKey: saasToken });
                if(response.status !== 200) {
                    const resp = {
                        saasContex: null,
                        isSaasMode: true,
                        hasAccess: false,
                        apiClient: null,
                        error: response.message
                    }
                    saasCtxCache.set(saasToken ?? '' + databaseIdHash, resp, 60 * 2); // errors cachef for 2s
                    return resp;

                } else {
                    const saasContext = await response.data as SaaSDTO;

                    // this is a data encyrption using the CTT stored encryption key (passed by SaaSContext)
                    // to achieve the end2end encryption, for user messages we need to:
                    // User - means open-agents-builder user
                    // End User - meands Open Agents Builder generated agent user (so use of our users's agent)
                    // - generate a dynamic per-session encryption key and store it with the agent End User
                    // - encrypt the message with the generated key
                    // - store the encrypted message in the database
                    // - store the per-session key - encrypted with the the User key
                    const encUtils = new EncryptionUtils(process.env.SAAS_ENCRYPTION_KEY || '')
                    saasContext.storageKey = await encUtils.decrypt(saasContext?.storageKey || '');
                    
                    const resp = {
                        saasContex: saasContext,
                        hasAccess: true,
                        isSaasMode: true,
                        apiClient: client
                    }
                    saasCtxCache.set(saasToken ?? '' + databaseIdHash, resp, 60 * 60 * 10); // ok results cached for 10 min
                    return resp;
                }
            } catch (e) {
                if (e instanceof ApiError && e.code && e.code === 'ECONNREFUSED') { // saas is down
                    return {
                        saasContex: null,
                        isSaasMode: false,
                        hasAccess: true,
                        apiClient: null
                    }
                } else {
                    return {
                        saasContex: null,
                        isSaasMode: false,
                        hasAccess: false,
                        apiClient: null,
                        error: getErrorMessage(e)
                    }
                }
            }
        }
    }
}

export async function authorizeStorageSchema(request: Request, response?: NextResponse): Promise<string> {
    const storageSchema = request.headers.get('Storage-Schema') || StorageSchemas.Default;
    if (storageSchema === StorageSchemas.Default) // default is empty string
        return storageSchema;
    
    if (storageSchema && [StorageSchemas.Commerce, StorageSchemas.Default, StorageSchemas.VectorStore].includes(storageSchema as StorageSchemas)) {
        return storageSchema;
    } else {
        throw new Error('Unauthorized. Wrong Storage Partition');
    }
}

export async function genericPUT<T extends { [key:string]: any }>(inputObject: any, schema: { safeParse: (a0:any) => { success: true; data: T; } | { success: false; error: ZodError; } }, repo: BaseRepository<T>, identityKey: string): Promise<ApiResult> {
    try {
        const validationResult = schema.safeParse(inputObject); // validation
        if (validationResult.success === true) {
            const updatedValues:T = validationResult.data as T;
            const upsertedData = await repo.upsert({ [identityKey]: updatedValues[identityKey] }, updatedValues)

            return {
                message: 'Data saved successfully!',
                data: upsertedData,
                status: 200
            };
        } else {
            return {
                message: getZedErrorMessage(validationResult.error),
                issues: validationResult.error.issues,
                status: 400               
            };
        }
    } catch (e) {
        console.error(e);
        return {
            message: getErrorMessage(e),
            error: e,
            status: 500
        };
    }
}

export async function genericGET<T extends { [key:string]: any }>(request: NextRequest, repo: BaseRepository<T>, defaultLimit: number = -1, defaultOffset: number  = -1): Promise<T[]> {
    const filterObj: Record<string, string> = Object.fromEntries(request.nextUrl.searchParams.entries());

    let limit = defaultLimit;
    let offset = defaultOffset;
    if (filterObj.limit) {
        limit = parseInt(filterObj.limit);
    }
    if (filterObj.offset) {
        offset = parseInt(filterObj.offset);
    }
    const items: T[] = await repo.findAll({ filter: filterObj, limit, offset });
    return items;
}


export async function genericDELETE<T extends { [key:string]: any }>(request: Request, repo: BaseRepository<T>, query: Record<string, string | number>): Promise<ApiResult>{
    try {
        if(await repo.delete(query)) {
            return {
                message: 'Data deleted successfully!',
                status: 200
            }
        } else {
            return {
                message: 'Data not found!',
                status: 400
            }
        }
    } catch (e) {
        console.error(e);
        return {
            message: getErrorMessage(e),
            error: e,
            status: 500
        }
    }
}



export async function auditLog(logObj: AuditDTO, request: NextRequest | null, requestContext: { databaseIdHash: string, keyLocatorHash?: string } , saasContext: AuthorizedSaaSContext) {

    const encUtils = new EncryptionUtils((saasContext.saasContex?.storageKey + (process.env.SAAS_ENCRYPTION_KEY ?? '')) || '');
    if (request) logObj.ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || request.ip;
    if (request) {
        const { device, ua } = userAgent(request);
        logObj.ua = ua;
    }
        
    logObj.databaseIdHash = requestContext.databaseIdHash;
    logObj.keyLocatorHash = requestContext.keyLocatorHash;
    logObj.createdAt = new Date().toISOString();

    // TODO: Add audit rotation
    const now = new Date();
    const dbPartition = `${now.getFullYear()}-${now.getMonth()}`; // partition daily
    const apiResult = await genericPUT<AuditDTO>(logObj, auditDTOSchema, new ServerAuditRepository(requestContext.databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null, 'audit', dbPartition), 'id');

    if (saasContext.apiClient) {
        saasContext.apiClient.saveEvent(requestContext.databaseIdHash, {
            eventName: logObj.eventName as string,
            databaseIdHash: requestContext.databaseIdHash,
            params: await encUtils.encrypt(JSON.stringify({ recordLocator: JSON.parse(logObj.recordLocator as string), diff: JSON.parse(logObj.diff ?? '{}') }))
        });
    }
    return apiResult;
}