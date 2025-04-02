import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";
import { OrderDTO, PaginatedResult } from "@/data/dto";
import { GetProductsPaginatedResponse } from "./product-api-client";
import { urlParamsForQuery } from "./base-api-client";

export type GetOrdersPaginatedResponse = PaginatedResult<OrderDTO[]>;

export type GetOrdersResponse = OrderDTO[];
export type PutOrderResponseSuccess = {
  status: 200;
  data: OrderDTO;
};
export type PutOrderResponseError = {
  status: number; // np. 400
  error: any;
};
export type PutOrderResponse = PutOrderResponseSuccess | PutOrderResponseError;

export type DeleteOrderResponse = {
  message: string;
  status: number;
};

export class OrderApiClient extends AdminApiClient {
  constructor(
    baseUrl: string,
    dbContext?: DatabaseContextType | null,
    saasContext?: SaaSContextType | null,
    encryptionConfig?: ApiEncryptionConfig
  ) {
    super(baseUrl, dbContext, saasContext, encryptionConfig);
  }

  async query(params: { agentId: string, limit: number; offset: number; orderBy?: string; query?: string; }): Promise<GetOrdersPaginatedResponse> {
    const { limit, offset, orderBy, query } = params;
    const queryParams = urlParamsForQuery({ limit, offset, orderBy: orderBy || '', query: query || '' });
    return this.request<GetOrdersPaginatedResponse>(
      `/api/order?${queryParams}&agentId=${encodeURIComponent(params.agentId)}`,
      "GET",
      { encryptedFields: [] }
    ) as Promise<GetOrdersPaginatedResponse>;
  }


  async get(orderId?: string): Promise<GetOrdersPaginatedResponse> {
    if (orderId) {
      // /api/order?id=...
      return this.request<GetOrdersPaginatedResponse>(
        `/api/order?id=${encodeURIComponent(orderId)}`,
        "GET",
        { encryptedFields: [] } // w razie potrzeby szyfrowania
      ) as Promise<GetOrdersPaginatedResponse>;
    } else {
      // lista wszystkich
      return this.request<GetOrdersPaginatedResponse>(
        `/api/order`,
        "GET",
        { encryptedFields: [] }
      ) as Promise<GetOrdersPaginatedResponse>;
    }
  }

  /**
   * Tworzy / aktualizuje zamówienie (upsert).
   * PUT /api/order
   */
  async put(order: OrderDTO): Promise<PutOrderResponse> {
    return this.request<PutOrderResponse>(
      "/api/order",
      "PUT",
      { encryptedFields: [] }, // np. szyfrowanie
      order
    ) as Promise<PutOrderResponse>;
  }

  /**
   * Usuwa zamówienie
   * DELETE /api/order/[id]
   */
  async delete(orderId: string): Promise<DeleteOrderResponse> {
    return this.request<DeleteOrderResponse>(
      `/api/order/${encodeURIComponent(orderId)}`,
      "DELETE",
      { encryptedFields: [] }
    ) as Promise<DeleteOrderResponse>;
  }
}
