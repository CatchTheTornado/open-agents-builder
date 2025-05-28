import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { SaaSContextType } from "@/contexts/saas-context";
import { AgentDTO, AgentDTOEncSettings, PaginatedQuery, PaginatedResult, ResultDTO, SessionDTO, TestCaseDTO } from "../dto";
import { DatabaseContextType } from "@/contexts/db-context";
import { urlParamsForQuery } from "./base-api-client";
import axios from "axios";

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


export interface GenerateTestCasesResponse {
  testCases: TestCaseDTO[];
}

export interface RunEvalsResponse {
  testCases: TestCaseDTO[];
}

export interface AdjustTestCaseResponse {
  testCase: TestCaseDTO;
}

export class AgentApiClient extends AdminApiClient {
  constructor(baseUrl?: string, databaseContext?: DatabaseContextType | null, saasContext?: SaaSContextType | null, encryptionConfig?: ApiEncryptionConfig, locale?: string) {
    super(baseUrl, databaseContext, saasContext, encryptionConfig, locale);
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

  async runEvals(agentId: string, testCases: TestCaseDTO[], apiKey: string): Promise<RunEvalsResponse> {
    return this.request<RunEvalsResponse>(
      `/api/agent/${agentId}/evals/run`,
      'POST',
      { encryptedFields: [] },
      { testCases, apiKey }
    ) as Promise<RunEvalsResponse>;
  }

  async *runEvalsStream(
    agentId: string,
    testCases: TestCaseDTO[]
  ): AsyncGenerator<any, void, unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    this.setAuthHeader('', headers);

    const makeRequest = async (repeatedRequestAccessToken: string = '') => {
      if (repeatedRequestAccessToken) {
        headers['Authorization'] = `Bearer ${repeatedRequestAccessToken}`;
      }

      const response = await fetch(`/api/agent/${agentId}/evals/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ testCases })
      });

      if (response.status === 401) {
        console.error('Unauthorized, first and only refresh attempt');
        // Refresh token
        if (!repeatedRequestAccessToken) {
          const refreshResult = await this.dbContext?.refresh({
            refreshToken: this.dbContext.refreshToken
          });
          if (refreshResult?.success) {
            console.log('Refresh token success', this.dbContext?.accessToken);
            return makeRequest(refreshResult.accessToken);
          } else {
            this.dbContext?.logout();
            throw new Error('Request failed. Refresh token failed. Try log-in again.');
          }
        } else {
          this.dbContext?.logout();
          throw new Error('Request failed. Refresh token failed. Try log-in again.');
        }
      }

      if (!response.ok) {
        throw new Error('Failed to run evaluations');
      }

      return response;
    };

    const response = await makeRequest();

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          console.error('JSON parse error:', err, '\nLine:', line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer);
      } catch (err) {
        console.error('JSON parse error:', err, '\nLine:', buffer);
      }
    }
  }

  async adjustTestCase(
    agentId: string,
    testCaseId: string,
    actualResult: string
  ): Promise<AdjustTestCaseResponse> {
    return this.request<AdjustTestCaseResponse>(
      `/api/agent/${agentId}/evals/adjust`,
      'POST',
      { encryptedFields: [] },
      { testCaseId, actualResult }
    ) as Promise<AdjustTestCaseResponse>;
  }
}
