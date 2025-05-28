import { DTOEncryptionFilter, EncryptionUtils } from "@/lib/crypto";
import { DTOEncryptionSettings } from "../dto";
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { ApiError } from "./base-api-client";

export type ApiEncryptionConfig = {
  secretKey?: string;
  useEncryption: boolean;
};



export class AdminApiClient {
  private baseUrl: string;
  private encryptionFilter: DTOEncryptionFilter<any> | null = null;
  private encryptionConfig?: ApiEncryptionConfig | null = null;
  private encryptionUtils: EncryptionUtils | null = null;
  protected dbContext?: DatabaseContextType | null = null;
  protected saasContext?: SaaSContextType | null = null;
  protected saasToken: string | null = null;
  protected databaseIdHash: string | null = null;
  protected locale: string = 'en';

  constructor(baseUrl?: string, databaseContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig, locale?: string) {
    this.baseUrl = baseUrl || '';
    this.dbContext = databaseContext;
    this.saasContext = saasContext;
    if (this.dbContext) this.databaseIdHash = this.dbContext.databaseIdHash;
    if (this.saasContext) this.setSaasToken(this.saasContext.saasToken ?? '');
    if (encryptionConfig?.useEncryption) {
      this.encryptionFilter = new DTOEncryptionFilter(encryptionConfig.secretKey as string);
    }
    this.encryptionUtils = new EncryptionUtils(encryptionConfig?.secretKey as string);
    this.encryptionConfig = encryptionConfig;
    if (locale) this.locale = locale;
  }

  public setSaasToken(token: string) {
    this.saasToken = token;
  }

  public setDatabaseIdHash(databaseIdHash: string) {
    this.databaseIdHash = databaseIdHash;
  }

  public setLocale(locale: string) {
    this.locale = locale;
  }

  public async getArrayBuffer(
    endpoint: string,
    repeatedRequestAccessToken = '',
    headers: Record<string, string> = {}
  ): Promise<ArrayBuffer | null | undefined> {
    if (this.dbContext?.accessToken || repeatedRequestAccessToken) {
      headers['Authorization'] = `Bearer ${repeatedRequestAccessToken ? repeatedRequestAccessToken : this.dbContext?.accessToken}`;
    }

    if(this.databaseIdHash) {
      headers['Database-Id-Hash'] = this.databaseIdHash;
    }

    if(this.saasToken) {
      headers['SaaS-Token'] = this.saasToken;
    }

    const config: AxiosRequestConfig = {
      method: 'GET',
      url: `${this.baseUrl}${endpoint}`,
      headers,
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    };

    try {
      const response: AxiosResponse<ArrayBuffer> = await axios(config);

      if(response.status === 401) {
        console.error('Unauthorized, first and only refresh attempt');
        // Refresh token
        if (!repeatedRequestAccessToken) {
          const refreshResult = await this.dbContext?.refresh({
            refreshToken: this.dbContext.refreshToken
          })
          if((refreshResult)?.success) {
            console.log('Refresh token success', this.dbContext?.accessToken);
            return this.getArrayBuffer(endpoint, refreshResult.accessToken);
          } else {
            this.dbContext?.logout();
            throw new Error('Request failed. Refresh token failed. Try log-in again.');
          }
        } else {
          this.dbContext?.logout();
          throw new Error('Request failed. Refresh token failed. Try log-in again.');
        }
      }

      // if (response.status >= 400) {
      //   throw new Error(response.statusText || 'Request failed');
      // } we're processing HTTP response errors in the calling party
      return (this.encryptionConfig?.useEncryption) ? this.encryptionUtils?.decryptArrayBuffer(response.data) : response.data;
      
    } catch (error) {
      throw new Error('Request failed');
    }
  }

  public async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    encryptionSettings?: DTOEncryptionSettings,
    body?: any,
    formData?: FormData,
    repeatedRequestAccessToken:string = '',
    headers: Record<string, string> = {}
  ): Promise<T | T[]> {

    this.setAuthHeader<T>(repeatedRequestAccessToken, headers);

    if (!repeatedRequestAccessToken) { //  if this is just a repeated request - in case of token refresh we're not encrypting data second time
      if (formData) {
          if (this.encryptionFilter) {
            throw new Error('Encryption is not supported for FormData');
          }

          // Set Content-Type header to 'multipart/form-data'
          headers['Content-Type'] = 'multipart/form-data';
        } else {
          // Set Content-Type header to 'application/json'
          headers['Content-Type'] = 'application/json';

          // Encrypt body if encryptionFilter is available
          if (body && this.encryptionFilter) {
            body = await this.encryptionFilter.encrypt(body, encryptionSettings);
          }
        }
    } else {
      console.log('Repeated request to ' + endpoint + ', skipping encryption')
    }
    const config: AxiosRequestConfig = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers,
      data: formData ? formData : body ? JSON.stringify(body) : undefined,
      validateStatus: (status) => status < 500,
    };

    try {
      const response: AxiosResponse = await axios(config);

      if(response.status === 401) {
        console.error('Unauthorized, first and only refresh attempt');
        // Refresh token
        if (!repeatedRequestAccessToken) {
          const refreshResult = await this.dbContext?.refresh({
            refreshToken: this.dbContext.refreshToken
          })
          if((refreshResult)?.success) {
            console.log('Refresh token success', this.dbContext?.accessToken);
            return this.request(endpoint, method, encryptionSettings, body, formData, refreshResult.accessToken);
          } else {
            this.dbContext?.logout();
            toast.error('Refresh token failed. Please try to log-in again.');
            throw new ApiError('Request failed. Refresh token failed. Try log-in again.', 401, refreshResult);
          }
        } else {
          this.dbContext?.logout();
          toast.error('Refresh token failed. Please try to log-in again.');
          throw new ApiError('Request failed. Refresh token failed. Try log-in again.', 401, null);
        }
      }

/*      if (response.status >= 400) {
        const errorData = response.data;
        throw new Error(errorData.message || 'Request failed');
      }*/ // commented out bc. we're processing response statuses in the calling party

      const responseData = response.data;

      if (this.encryptionFilter) {
        if (responseData instanceof Array) {
          const decryptedData = await Promise.all(responseData.map(async (data) => await this.encryptionFilter.decrypt(data, encryptionSettings)));
          return decryptedData as T[];
        } else {
          const decryptedData = await this.encryptionFilter.decrypt(responseData, encryptionSettings);
          return decryptedData as T;
        }
      } else {
        return responseData;
      }
    } catch (error) {
      console.error(error);
      throw new ApiError('Request failed' + getErrorMessage(error) + ' [' + error.code + ']', error.code, error);
    }
  }

  protected setAuthHeader<T>(repeatedRequestAccessToken: string, headers: Record<string, string>) {
    if (this.dbContext?.accessToken || repeatedRequestAccessToken) {
      headers['Authorization'] = `Bearer ${repeatedRequestAccessToken ? repeatedRequestAccessToken : this.dbContext?.accessToken}`;
    }

    if (this.databaseIdHash) {
      headers['Database-Id-Hash'] = this.databaseIdHash;
    }

    if (this.saasToken) {
      headers['SaaS-Token'] = this.saasToken;
    }

    headers['Agent-Locale'] = this.locale;
  }
}