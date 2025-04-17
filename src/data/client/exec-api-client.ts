import { BaseApiClient } from "./base-api-client";
import { AgentDTO, StorageSchemas } from "../dto";
import { ExecInitFormType } from "@/contexts/exec-context";
import { PutAttachmentRequest, PutAttachmentResponse } from "./attachment-api-client";

export type GetAgentsResponse = {
  message: string;
  data: AgentDTO;
  status: 200;
};;
export type PutAgentRequest = AgentDTO;

export type PutAgentResponseSuccess = {
  message: string;
  data: AgentDTO;
  status: 200;
};

export type DeleteAgentResponse = {
  message: string;
  status: 200;
};

export type PutAgentResponseError = {
  message: string;
  status: 400;
  issues?: any[];
};

export type SaveSessionResponse = {
  message: string;
  status: number;
  id?: string
};

export type PutAgentResponse = PutAgentResponseSuccess | PutAgentResponseError;


export class ExecApiClient extends BaseApiClient {
    constructor(databaseIdHash: string, baseUrl?: string) {
      super(baseUrl, databaseIdHash);
    }
    async agent(agentId:string): Promise<GetAgentsResponse> {
      return await (this.request<GetAgentsResponse>('/api/exec/agent/' + encodeURIComponent(agentId) , 'GET') as Promise<GetAgentsResponse>);
    }


    async upload(inputObject:PutAttachmentRequest): Promise<PutAttachmentResponse> {
      if (inputObject instanceof FormData) {
        return this.sendForm<PutAttachmentResponse>('/api/chat/upload', 'PUT',  {
          'Storage-Schema': StorageSchemas.Default,
        }, inputObject as FormData) as Promise<PutAttachmentResponse>;
      } else {
        throw new Error('Invalid input type. Expected FormData - which is only form data supported for the public chat.');
      }
    }

    async saveInitForm(sessionId: string, formData: ExecInitFormType): Promise<SaveSessionResponse> {
      return await this.request<SaveSessionResponse>('/api/exec/session/' + encodeURIComponent(sessionId), 'POST', {}, formData) as SaveSessionResponse;
    }


  
}