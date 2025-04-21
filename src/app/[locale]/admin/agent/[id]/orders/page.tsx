"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InfiniteScroll from "@/components/infinite-scroll";
import { NoRecordsAlert } from "@/components/shared/no-records-alert";
import { FolderOpenIcon, Loader2, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { getErrorMessage } from "@/lib/utils";

import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Kontekst zamówień
import { useOrderContext } from "@/contexts/order-context";

// Modele
import { Order, ORDER_STATUSES } from "@/data/client/models";
import { PaginatedQuery, PaginatedResult } from "@/data/dto";

// Ikony przykładowe
import { BoxIcon, ListOrderedIcon } from "lucide-react";
import { useAgentContext } from "@/contexts/agent-context";
import moment from "moment";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";
import { nanoid } from "nanoid";
import { Credenza, CredenzaContent, CredenzaTrigger } from "@/components/credenza";
import { Chat } from "@/components/chat";
import { useChat } from "ai/react";
import { OrderDeleteDialog } from "@/components/order-delete-dialog";

/**
 * Strona z listą zamówień, analogiczna do "ProductsPage"
 */
export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const agentContext = useAgentContext();
  const router = useRouter();
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);

  // Kontekst do obsługi zamówień
  const orderContext = useOrderContext();

  // Stan do paginacji / wyszukiwania
  const [ordersQuery, setOrdersQuery] = useState<PaginatedQuery>({
    limit: 4,
    offset: 0,
    orderBy: "createdAt",
    query: "",
  });
  const [debouncedSearchQuery] = useDebounce(ordersQuery, 500);

  // Stan do przechowywania pobranych zamówień
  const [ordersData, setOrdersData] = useState<PaginatedResult<Order[]>>({
    rows: [],
    total: 0,
    limit: 4,
    offset: 0,
    orderBy: "createdAt",
    query: "",
  });

  const [ordersLoading, setOrdersLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 4; // kolejny przyrost paginacji

  // 1) useEffect => wczytanie 1. strony (offset=0) za każdym razem, gdy zmienia się debouncedSearchQuery
  useEffect(() => {
      if (agentContext && agentContext.current) {
      (async () => {
        setOrdersLoading(true);
        try {
          const response = await orderContext.queryOrders({
            agentId: agentContext.current?.id || "",
            limit: debouncedSearchQuery.limit,
            offset: 0,
            orderBy: debouncedSearchQuery.orderBy,
            query: debouncedSearchQuery.query,
          });
          // response => PaginatedResult z polami {rows, total, limit, offset, ...}
          // Zakładam, że rowy to OrderDTO => mapujemy do Order
          const mappedRows = response.rows.map((dto) => Order.fromDTO(dto));
          setOrdersData({
            ...response,
            rows: mappedRows,
          });
          setHasMore(mappedRows.length < response.total);
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
        setOrdersLoading(false);
      })();
    }
    // Kiedy odświeżać - ewentualnie orderContext.refreshDataSync
  }, [debouncedSearchQuery, orderContext.refreshDataSync,  agentContext?.current]);

  // 2) useEffect => ustawia hasMore
  useEffect(() => {
    setHasMore(ordersData.offset + ordersData.limit < ordersData.total);
  }, [ordersData]);

  // Funkcja do wczytania kolejnej paczki (infinite scroll)
  const loadMore = async () => {
    if (ordersLoading) return;
    const newOffset = ordersData.limit + ordersData.offset;
    if (newOffset >= ordersData.total) {
      setHasMore(false);
      return;
    }
    setOrdersLoading(true);

    try {
      const response = await orderContext.queryOrders({
        agentId: agentContext.current?.id || '',
        limit: pageSize,
        offset: newOffset,
        orderBy: ordersData.orderBy,
        query: ordersData.query,
      });
      const mappedRows = response.rows.map((dto) => Order.fromDTO(dto));

      setOrdersData((prev) => ({
        rows: [...prev.rows, ...mappedRows],
        total: response.total,
        limit: prev.limit + response.limit,
        offset: newOffset,
        orderBy: prev.orderBy,
        query: prev.query,
      }));
      setHasMore(newOffset + response.limit < response.total);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }

    setOrdersLoading(false);
  };


  const { messages, handleInputChange, isLoading, append, handleSubmit, input} = useChat({
    api: "/api/agent/results-chat",
  });
  const [isResultsChatOpen, setResultsChatOpen] = useState(false);
  
  const getSessionHeaders = () => {
    return {
      'Database-Id-Hash': dbContext?.databaseIdHash ?? '',
      'Agent-Id': agentContext.current?.id ?? '',
      'Agent-Locale': i18n.language,
      'Current-Datetime-Iso': new Date().toISOString(),
      'Current-Datetime': new Date().toLocaleString(),
      'Current-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
  useEffect(() => {
    if (agentContext.current && isResultsChatOpen){
      append({
        id: nanoid(),
        role: "user",
        content: t("Lets chat")
      }, {
        headers: getSessionHeaders()
      }).catch((e) => {
        console.error(e);
        toast.error(t(getErrorMessage(e)))
      })
    }
  }, [agentContext.current, isResultsChatOpen]);



  // Render
  return (
    <div className="space-y-6">
      {/* Przykładowy link do "create new order" */}
      <div className="flex space-x-2">
        <Link href={`/admin/agent/${agentContext.current?.id}/orders/new`}>
          <Button size="sm" variant="outline">
            <BoxIcon className="w-4 h-4 mr-2" />
            {t("Add new order...")}
          </Button>
        </Link>
        <Credenza open={isResultsChatOpen} onOpenChange={setResultsChatOpen}>
          <CredenzaTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => setResultsChatOpen(true)}><MessageCircleIcon /> {t('Chat with orders ...')}</Button>
          </CredenzaTrigger>
          <CredenzaContent className="max-w-3xl">
            {saasContext.saasToken && (saasContext.checkQuotas()).status === 200 ? ( 
              <Chat
                headers={getSessionHeaders()}
                welcomeMessage={t("By using this chat you may **ask** some cool questions or **modify** the orders:\n\n- **List last 10 orders**?\n\n- **Change order status to Closed**\n\n- **What is the total order value from Today**?")}
                messages={messages}
                handleInputChange={handleInputChange}
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                input={input}
                displayName={t('Chat with orders')}
                databaseIdHash={dbContext?.databaseIdHash ?? ''}
              />
            ): <div className='text-sm text-center text-red-500 p-4'>{t('Please verify your E-mail address and AI budget to use all features of Open Agents Builder')}</div>}
          </CredenzaContent>
        </Credenza>           
      </div>

      {/* Search input */}
      <Input
        placeholder={t("Search orders...") || "Search orders..."}
        onChange={(e) => {
          setOrdersQuery({
            ...ordersQuery,
            query: e.target.value,
          });
        }}
        value={ordersQuery.query}
      />

      {/* Gdy pusto */}
      {ordersData.rows.length === 0 && !ordersLoading ? (
        <NoRecordsAlert title={t("No orders found")}>
          {t("Try adjusting your search or add new orders.")}
        </NoRecordsAlert>
      ) : null}

      {/* Lista zamówień */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-6 gap-6">
        {ordersData.rows.map((order) => (
          <Card key={order.id} className=" min-w-[250px]">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {/* przycisk otwierający szczegóły zamówienia */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // np. /admin/orders/ORDER_ID
                    router.push(`/admin/agent/${agentContext.current?.id}/orders/${order.id}`);
                  }}
                >
                  <FolderOpenIcon className="w-4 h-4" />
                </Button>
                <Link href={`/admin/agent/${agentContext.current?.id}/orders/${order.id}`}>{t("Order")} #{order.id}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm flex">
              <div>
                {/* Status zamówienia */}
                {order.status && (
                  <div className="mb-2">
                    <strong>{t("Status")}:</strong> {ORDER_STATUSES.find(os => os.value == order.status)?.label || order.status}
                  </div>
                )}

                {/* Ilość pozycji */}
                {order.items && (
                  <div className="mb-2">
                    <strong>{t("Items")}:</strong> {order.items.length}
                  </div>
                )}


                {/* Daty */}
                <div className="mb-2">
                  <strong>{t("Created")}:</strong> {moment(order.createdAt).format("YYYY-MM-DD")}
                </div>
              </div>
              <div className="ml-4">
                <div className="mb-2">
                  {order.items && ((order.items?.length || 0) > 3 ? (order.items?.slice(0, 3)) : order.items ?? []).map(i=> (
                    <div key={i.id} className="border-b pb-2">
                      {i.quantity} x <strong>{i.name}</strong> {i.variantName ? (i.variantName) : (null)} - {i.price.value} {i.price.currency}
                    </div>

                    )
                  )}
                  {order.items && order.items.length > 3 ? (
                   <span className="text-sm pb-4">{order.items.length-3} {t('more ...')}</span> 
                  ): null}
                </div>


                {/* Suma zamówienia */}
                {order.subTotalInclTax && (
                  <div className="mb-2 grid grid-cols-2">
                    <div className="pr-2"><strong>{t("Subtotal incl. tax")}:</strong>{" "}</div>
                    <div>{order.subTotalInclTax.value} {order.subTotalInclTax.currency}</div>
                  </div>
                )}                

                {order.shippingPriceInclTax && (
                  <div className="mb-2 grid grid-cols-2">
                    <div className="pr-2"><strong>{t("Shipping cost")}:</strong>{" "}</div>
                    <div>{order.shippingPriceInclTax?.value} {order.shippingPriceInclTax?.currency}</div>
                  </div>
                )}                
                {order.totalInclTax && (
                  <div className="mb-2 grid grid-cols-2">
                    <div className="pr-2"><strong>{t("Total incl. tax")}:</strong>{" "}</div>
                    <div>{order.totalInclTax.value} {order.totalInclTax.currency}</div>
                  </div>
                )}                

              </div>
            </CardContent>
            <div className="flex justify-end p-2 pb-4">
              <OrderDeleteDialog order={order} />
            </div>
          </Card>
        ))}
      </div>

      {/* Infinite scroll */}
      <InfiniteScroll
        hasMore={hasMore}
        isLoading={ordersLoading}
        next={loadMore}
        threshold={1}
      >
        {hasMore && (
          <div className="flex justify-center">
            <Loader2 className="my-4 h-8 w-8 animate-spin" />
          </div>
        )}
      </InfiniteScroll>
    </div>
  );
}
