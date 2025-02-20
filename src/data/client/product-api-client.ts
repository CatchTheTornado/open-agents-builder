// product-api-types.ts

import { ProductDTO, PaginatedResult } from "../dto";
import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";
import { DatabaseContextType } from "@/contexts/db-context";
import { urlParamsForQuery } from "./base-api-client";

export type GetProductsResponse = ProductDTO[]; // kiedy zwykły GET
export type GetProductsPaginatedResponse = PaginatedResult<ProductDTO[]>;

// PUT
export type PutProductResponseSuccess = {
  message: string;
  data: ProductDTO;
  status: 200;
};

export type PutProductResponseError = {
  message: string;
  status: number;
  issues?: any[];
};

export type PutProductResponse = PutProductResponseSuccess | PutProductResponseError;

// DELETE
export type DeleteProductResponse = {
  message: string;
  status: number;
};



export class ProductApiClient extends AdminApiClient {
  constructor(
    baseUrl: string, 
    dbContext?: DatabaseContextType | null, 
    saasContext?: SaaSContextType | null, 
    encryptionConfig?: ApiEncryptionConfig
  ) {
    super(baseUrl, dbContext, saasContext, encryptionConfig);
  }

  async get(productId?: string): Promise<GetProductsResponse> {
    if (productId) {
      // /api/product?id=...
      return this.request<GetProductsResponse>(
        `/api/product?id=${encodeURIComponent(productId)}`,
        "GET",
        { ecnryptedFields: [] } // lub pola do szyfrowania
      ) as Promise<GetProductsResponse>;
    } else {
      // /api/product
      return this.request<GetProductsResponse>(
        "/api/product",
        "GET",
        { ecnryptedFields: [] }
      ) as Promise<GetProductsResponse>;
    }
  }

  async query(params: { limit: number; offset: number; orderBy?: string; query?: string; }): Promise<GetProductsPaginatedResponse> {
    const { limit, offset, orderBy, query } = params;
    const queryParams = urlParamsForQuery({ limit, offset, orderBy: orderBy || '', query: query || '' });
    return this.request<GetProductsPaginatedResponse>(
      `/api/product?${queryParams}`,
      "GET",
      { ecnryptedFields: [] }
    ) as Promise<GetProductsPaginatedResponse>;
  }

  async put(record: ProductDTO): Promise<PutProductResponse> {
    return this.request<PutProductResponse>(
      "/api/product",
      "PUT",
      { ecnryptedFields: [] }, // w razie potrzeby
      record
    ) as Promise<PutProductResponse>;
  }

  async delete(record: ProductDTO): Promise<DeleteProductResponse> {
    return this.request<DeleteProductResponse>(
      `/api/product/${record.id}`,
      "DELETE",
      { ecnryptedFields: [] }
    ) as Promise<DeleteProductResponse>;
  }
}
