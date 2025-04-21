import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getErrorMessage } from "@/lib/utils";
import { PaginatedQuery } from '../dto';

export class ApiError extends Error {
  public code: number|string;
  public additionalData?: any;

  constructor(message: string, code: number|string, additionalData?: any) {
    super(message);
    this.code = code;
    this.additionalData = additionalData;
  }
}

export function urlParamsForQuery({ query, limit, offset, orderBy }: PaginatedQuery): string {
  return `query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&orderBy=${encodeURIComponent(orderBy)}`;
}


export class BaseApiClient {
  private baseUrl: string;
  private databaseIdHash: string | null = null;

  constructor(baseUrl?: string, databaseIdHash?: string) {
    this.baseUrl = baseUrl || '';
    this.databaseIdHash = databaseIdHash || '';
  }

  public setDatabaseIdHash(databaseIdHash: string) {
    this.databaseIdHash = databaseIdHash;
  }

  public async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    headers: Record<string, string> = {},
    body?: any
  ): Promise<T | T[]> {

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.databaseIdHash && !headers['Database-Id-Hash']) {
      headers['Database-Id-Hash'] = this.databaseIdHash;
    }

    const config: AxiosRequestConfig = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers,
      data: body ? JSON.stringify(body) : undefined,
      validateStatus: (status) => status < 500,
    };

    try {
      const response: AxiosResponse = await axios(config);
      return response.data
    } catch (error) {
      console.error(error);
      throw new ApiError('Request failed' + getErrorMessage(error) + ' [' + error.code + ']', error.code, error);
    }
  }

  public async sendForm<T>(
    endpoint: string,
    method: 'POST' | 'PUT',
    headers: Record<string, string> = {},
    formData: FormData
  ): Promise<T | T[]> {

    if (this.databaseIdHash && !headers['Database-Id-Hash']) {
      headers['Database-Id-Hash'] = this.databaseIdHash;
    }

    const config: AxiosRequestConfig = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        ...headers,
        'Content-Type': 'multipart/form-data',
      },
      data: formData,
      validateStatus: (status) => status < 500,
    };

    try {
      const response: AxiosResponse = await axios(config);
      return response.data;
    } catch (error) {
      console.error(error);
      throw new ApiError('Request failed' + getErrorMessage(error) + ' [' + error.code + ']', error.code, error);
    }
  }
}