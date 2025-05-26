import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";
import { AgentDTO, AgentDTOEncSettings, PaginatedQuery, PaginatedResult, ResultDTO, SessionDTO } from "../dto";
import { DatabaseContextType } from "@/contexts/db-context";
import { urlParamsForQuery } from "./base-api-client";
import axios from "axios";
import { FlowChunkEvent } from "@/flows/models";

export type GetResultResponse = PaginatedResult<ResultDTO[]>;
export type GetSessionResponse = PaginatedResult<SessionDTO[]>;
export type GetAgentsResponse = AgentDTO[];
export type PutAgentRequest = AgentDTO;

let abortController: AbortController;


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

export type PutAgentResponse = PutAgentResponseSuccess | PutAgentResponseError;

export interface TestCase {
  id: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: {
      name: string;
      arguments: Record<string, unknown>;
    }[];
  }[];
  expectedResult: string;
  actualResult?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

export interface GenerateTestCasesResponse {
  testCases: TestCase[];
}

export interface RunEvalsResponse {
  testCases: TestCase[];
}

export class AgentApiClient extends AdminApiClient {
  constructor(baseUrl: string, dbContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig) {
    super(baseUrl, dbContext, saasContext, encryptionConfig);
  }

  async get(agentId?: string): Promise<GetAgentsResponse> {
    if (agentId)
      return this.request<GetAgentsResponse>('/api/agent?id=' + encodeURIComponent(agentId), 'GET', AgentDTOEncSettings) as Promise<GetAgentsResponse>;
    else
      return this.request<GetAgentsResponse>('/api/agent', 'GET', AgentDTOEncSettings) as Promise<GetAgentsResponse>;
  }

  async results(agentId: string, { limit, offset, orderBy, query }: PaginatedQuery): Promise<GetResultResponse> {
    return this.request<GetResultResponse>('/api/agent/' + agentId + '/result?' + urlParamsForQuery({ limit, offset, orderBy, query }), 'GET', AgentDTOEncSettings) as Promise<GetResultResponse>;
  }

  async sessions(agentId: string, { limit, offset, orderBy, query }: PaginatedQuery): Promise<GetSessionResponse> {
    return this.request<GetSessionResponse>('/api/agent/' + agentId + '/session?' + urlParamsForQuery({ limit, offset, orderBy, query }), 'GET', AgentDTOEncSettings) as Promise<GetSessionResponse>;
  }

  async put(record: PutAgentRequest): Promise<PutAgentResponse> {
    return this.request<PutAgentResponse>('/api/agent', 'PUT', AgentDTOEncSettings, record) as Promise<PutAgentResponse>;
  }

  async delete(record: AgentDTO): Promise<DeleteAgentResponse> {
    return this.request<DeleteAgentResponse>('/api/agent/' + record.id, 'DELETE', { encryptedFields: [] }) as Promise<DeleteAgentResponse>;
  }


  async execSync(agentId: string, flowId: string, input: any, execMode: string, headers: Record<string, string>): Promise<any> {
    const requestBody = { flow: flowId, input, execMode, outputMode: '' };
    return this.request<any>('/api/agent/' + agentId + '/exec/', 'POST', AgentDTOEncSettings, requestBody, undefined, undefined, headers) as Promise<any>;
  }

  async *execStream(
    agentId: string,
    flowId: string,
    uiState: any,
    input: any,
    execMode: string,
    headers: Record<string, string>
  ): AsyncGenerator<any, void, unknown> {
    // Abort any previous connection
    if (abortController) abortController.abort();
    abortController = new AbortController();

    const requestBody = JSON.stringify({ flow: flowId, input, execMode, outputMode: "stream", uiState });
    if (!headers) headers = {};
    this.setAuthHeader('', headers);

    const response = await fetch(`/api/agent/${agentId}/exec/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: requestBody,
      signal: abortController.signal
    });

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          yield JSON.parse(line);
        } catch (err) {
          console.error("JSON parse error:", err, "\nLine:", line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer);
      } catch (err) {
        console.error("JSON parse error:", err, "\nLine:", buffer);
      }
    }
  }

  async generateTestCases(agentId: string, prompt: string): Promise<GenerateTestCasesResponse> {
    return this.request<GenerateTestCasesResponse>(
      `/api/agent/${agentId}/evals/generate`,
      'POST',
      { encryptedFields: [] },
      { prompt }
    ) as Promise<GenerateTestCasesResponse>;
  }

  async runEvals(agentId: string, testCases: TestCase[], apiKey: string): Promise<RunEvalsResponse> {
    return this.request<RunEvalsResponse>(
      `/api/agent/${agentId}/evals/run`,
      'POST',
      { encryptedFields: [] },
      { testCases, apiKey }
    ) as Promise<RunEvalsResponse>;
  }
}
