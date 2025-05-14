import { Agent } from '@/data/client/models';
import { AgentDTO, ResultDTO, StatDTO } from '@/data/dto';
import ServerAgentRepository from '@/data/server/server-agent-repository';
import ServerResultRepository from '@/data/server/server-result-repository';
import ServerStatRepository from '@/data/server/server-stat-repository';
import { authorizeSaasContext } from '@/lib/generic-api';
import { llmProviderSetup } from '@/lib/llm-provider';
import { renderPrompt } from '@/lib/templates';
import { validateTokenQuotas } from '@/lib/quotas';
import { getErrorMessage } from '@/lib/utils';
import { createCalendarListTool } from '@/tools/calendarListTool';
import { createCalendarScheduleTool } from '@/tools/calendarScheduleTool';
import { createCreateOrderTool } from '@/tools/createOrderTool';
import { createListProductsTool } from '@/tools/listProductsTool';
import { createOrderListTool } from '@/tools/ordersListTool';
import { createUpdateResultTool } from '@/tools/updateResultTool';
import { CoreMessage, Message, streamText } from 'ai';
import { NextRequest } from 'next/server';
import { getExecutionTempDir, processChatAttachments } from '@/lib/file-extractor';
import { nanoid } from 'nanoid';
import { createFileTools } from 'interpreter-tools';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    let { messages }: { messages: Message[] } = await req.json();
    const databaseIdHash = req.headers.get('Database-Id-Hash');
    const agentId = req.headers.get('Agent-Id');
    const locale = req.headers.get('Agent-Locale') || 'en';
    const sessionId = req.headers.get('Session-Id') || '';

    if(!databaseIdHash || !agentId) {
      return Response.json('The required HTTP headers: Database-Id-Hash and Agent-Id missing', { status: 400 });
    }

    const saasContext = await authorizeSaasContext(req);

    if (saasContext?.isSaasMode) {
        if (!saasContext.hasAccess) {
            return Response.json({ message: "Unauthorized", status: 403 }, { status: 403 });
        } else {

            if (saasContext.saasContex) {
                const resp = await validateTokenQuotas(saasContext.saasContex)
                if (resp?.status !== 200) {
                    return Response.json(resp)
                }
            } else {
                return Response.json({ message: "Unauthorized", status: 403 }, { status: 403 });
            }
        }
    }

    const repo = new ServerAgentRepository(databaseIdHash);

    const agent = Agent.fromDTO(await repo.findOne({
      id: agentId // TODO: fix seearching as it always return the same record!
    }) as AgentDTO);

    const currentDateTimeIso = req.headers.get('Current-Datetime-Iso') || new Date().toISOString();
    const currentLocalDateTime = req.headers.get('Current-Datetime') || new Date().toLocaleString();
    const currentTimezone = req.headers.get('Current-Timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const resultsRepo = new ServerResultRepository(databaseIdHash, saasContext.saasContex?.storageKey);
    const filter = sessionId ? {
        sessionId
      } : { agentId };
    const results = await await resultsRepo.findAll({
      filter
    })

    const resultMessages = results.map((result: ResultDTO) => {
      return {
        role: 'system',
        content: `Session Id: ${result.sessionId}, E-mail: ${result.userEmail} User name: ${result.userName} [created at: ${result.createdAt}] - ${result.content}`
      } as Message
    })

    const systemPrompt = await renderPrompt(locale, 'results-chat', { agent, currentDateTimeIso, currentLocalDateTime, currentTimezone, baseUrl: process.env.NEXT_PUBLIC_APP_URL  });

    messages.unshift({
      id: nanoid(),
      role: 'system',
      content: systemPrompt
    } as Message, ...resultMessages)


    try {
      messages = await processChatAttachments(messages, databaseIdHash, agentId, sessionId);
    } catch (err) {
      console.error("Error converting files", err);
    }

    const fileTools = createFileTools(getExecutionTempDir(databaseIdHash, agentId, sessionId), {
      '/session': getExecutionTempDir(databaseIdHash, agentId, sessionId)
    });    

    const result = await streamText({
      model: llmProviderSetup(),
      maxSteps: 10,  
      messages,
      tools: {
        calendarSchedule: createCalendarScheduleTool(agentId, sessionId, databaseIdHash, saasContext.saasContex?.storageKey).tool,
        calendarListEvents: createCalendarListTool(agentId, sessionId, databaseIdHash, saasContext.saasContex?.storageKey, true).tool,
        ordersList: createOrderListTool(agentId, sessionId, databaseIdHash, saasContext.saasContex?.storageKey).tool,
        createOrderTool: createCreateOrderTool(databaseIdHash, agentId, sessionId, saasContext.saasContex?.storageKey).tool,
        listSessionFiles: fileTools.listFilesTool,
        readSessionFile: fileTools.readFileTool,
        listProducts: createListProductsTool(databaseIdHash).tool,
        updateResults: createUpdateResultTool(databaseIdHash, saasContext.saasContex?.storageKey).tool
      },
      async onFinish({ response, usage }) {
      
        const usageData:StatDTO = {
          eventName: 'chat',
          completionTokens: usage.completionTokens,
          promptTokens: usage.promptTokens,
          createdAt: new Date().toISOString()
      }
        const statsRepo = new ServerStatRepository(databaseIdHash, 'stats');
        const result = await statsRepo.aggregate(usageData)

        const saasContext = await authorizeSaasContext(req);
        if (saasContext.apiClient) {
            saasContext.apiClient.saveStats(databaseIdHash, {
                ...result,
                databaseIdHash: databaseIdHash
            });
      }        

      },    
    });
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error streaming text:', getErrorMessage(error));
    return Response.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}