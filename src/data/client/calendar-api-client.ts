import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";
import { CalendarEventDTO, CalendarEventDTOEncSettings } from "../dto";
import { DatabaseContextType } from "@/contexts/db-context";

export type GetCalendarEventsResponse = CalendarEventDTO[];
export type PutCalendarEventRequest = CalendarEventDTO;

export type PutCalendarEventResponseSuccess = {
  message: string;
  data: CalendarEventDTO;
  status: 200;
};

export type DeleteCalendarEventResponse = {
  message: string;
  status: 200 | 400;
};

export type PutCalendarEventResponseError = {
  message: string;
  status: 400;
  issues?: any[];
};

export type PutCalendarEventResponse = PutCalendarEventResponseSuccess | PutCalendarEventResponseError;


export class CalendarEventApiClient extends AdminApiClient {
    constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
      super(baseUrl, dbContext, saasContext, encryptionConfig);
    }

    async get({ calendarEventId, agentId, sessionId } : { calendarEventId?:string, agentId?: string, sessionId?: string }): Promise<GetCalendarEventsResponse> {
    if (calendarEventId)
      return this.request<GetCalendarEventsResponse>('/api/calendar/?id=' + encodeURIComponent(calendarEventId) , 'GET', CalendarEventDTOEncSettings) as Promise<GetCalendarEventsResponse>;
    if (sessionId)
      return this.request<GetCalendarEventsResponse>('/api/calendar/?sessionId=' + encodeURIComponent(sessionId) , 'GET', CalendarEventDTOEncSettings) as Promise<GetCalendarEventsResponse>;
    if (agentId)
      return this.request<GetCalendarEventsResponse>('/api/calendar/?agentId=' + encodeURIComponent(agentId) , 'GET', CalendarEventDTOEncSettings) as Promise<GetCalendarEventsResponse>;
    else 
      return this.request<GetCalendarEventsResponse>('/api/calendar' , 'GET', CalendarEventDTOEncSettings) as Promise<GetCalendarEventsResponse>;
    }
    
    async put(record: PutCalendarEventRequest): Promise<PutCalendarEventResponse> {
      return this.request<PutCalendarEventResponse>('/api/calendar', 'PUT', CalendarEventDTOEncSettings, record) as Promise<PutCalendarEventResponse>;
    }

    async delete(record: CalendarEventDTO): Promise<DeleteCalendarEventResponse> {
      return this.request<DeleteCalendarEventResponse>('/api/calendar/' + record.id, 'DELETE', { encryptedFields: [] }) as Promise<DeleteCalendarEventResponse>;
    }    
}