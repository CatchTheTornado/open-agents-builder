// tools/index.ts
import { currentDateTool } from './currentDateTool';
import { Tool } from 'ai';
import { createEmailTool } from './sendEmailTool';
import { checkApiKey } from '@/lib/utils';
import { createCalendarScheduleTool } from './calendarScheduleTool';
import { createCalendarListTool } from './calendarListTool';
import { dayNameTool } from './dayNameTool';
import { createCreateOrderTool } from './createOrderTool';
import { createListProductsTool } from './listProductsTool';
import { httpTool } from './httpTool';
import { createAttachmentContentTool } from './attachmentContentTool';
import { StorageSchemas } from '@/data/dto';
import { createListAttachmentsTool } from './listAttachmentsTool';
import { createUpdateResultTool } from './updateResultTool';
import { createExecFlowTool } from './execFlowTool';
import { Agent } from '@/data/client/models';
import { AuthorizedSaaSContext } from '@/lib/generic-api';
import { createTraceTool } from './traceTool';
import { FlowChunkEvent } from '@/flows/models';
import { replaceBase64Content } from '@/lib/file-extractor';
import { createAvailableUIComponentsTool, getAvailableUIComponents } from './availableUIComponentsTool';
import { createRenderComponentTool } from './renderComponentTool';
import { createMemorySaveTool } from './memorySaveTool';
import { createMemorySearchTool } from './memorySearchTool';
import { createCodeExecutionTool } from './codeExecutionTool';
import { createCheckGmailTool } from './checkGmailTool';
export type ToolDescriptor = {
  displayName: string;
  tool: Tool;
  injectStreamingController?: (streamingController: ReadableStreamDefaultController<unknown>) => void;
}

let availableTools: Record<string, ToolDescriptor> | null = null;

export const toolRegistry = {
  init: ({ saasContext, databaseIdHash, storageKey, agentId, agent, sessionId, streamingController }: { 
    saasContext?: AuthorizedSaaSContext, 
    agentId: string, 
    sessionId: string, 
    agent?: Agent, 
    databaseIdHash: string, 
    storageKey: string | undefined | null, 
    streamingController?: ReadableStreamDefaultController<unknown> 
  }): Record<string, ToolDescriptor> => {
    const streamToOutput =
      (chunk: FlowChunkEvent) => {
        // Attach a timestamp
        chunk.timestamp = new Date();
        const encoder = new TextEncoder();

        // If we have a streaming controller and the outputMode is "stream", enqueue JSON chunk
        if (streamingController) {
          let textChunk: string = replaceBase64Content(JSON.stringify(chunk));
          textChunk = textChunk.replaceAll("\n", "").replaceAll("\r", "") + "\n"

          streamingController.enqueue(encoder.encode(textChunk));
        }
      }

    //if (availableTools !== null) return availableTools; // causes problem with the old streaming controlelr
    availableTools = {
      sendEmail: createEmailTool({
        apiKey: checkApiKey('Resend.com API key', 'RESEND_API_KEY', process.env.RESEND_API_KEY || ''),
      }),
      currentDate: currentDateTool,
      calendarSchedule: createCalendarScheduleTool(agentId, sessionId, databaseIdHash, storageKey),
      calendarList: createCalendarListTool(agentId, sessionId, databaseIdHash, storageKey),
      dayName: dayNameTool,
      createOrderTool: createCreateOrderTool(databaseIdHash, agentId, sessionId, storageKey),
      listProducts: createListProductsTool(databaseIdHash),
      attachmentContent: createAttachmentContentTool(databaseIdHash, storageKey, StorageSchemas.Default, agentId, sessionId),
      listAttachments: createListAttachmentsTool(databaseIdHash, storageKey, StorageSchemas.Default),
      updateResultTool: createUpdateResultTool(databaseIdHash, storageKey),
      httpTool: httpTool,
      codeExecutionTool: createCodeExecutionTool(agentId, sessionId, databaseIdHash, storageKey),
      checkGmailTool: createCheckGmailTool(databaseIdHash)
    }

    if (agent) {
      (agent.flows ?? []).forEach(flow => {
        const flowTool = createExecFlowTool({
          flow,
          agentId: agent.id ?? '',
          masterAgent: agent,
          saasContext,
          databaseIdHash,
          sessionId,
          currentDateTimeIso: new Date().toISOString(),
          currentLocalDateTime: new Date().toLocaleString(),
          currentTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          streamingController: streamingController ?? null
        })
        availableTools = {
          ...availableTools,
          ['flowTool' + flow.code]: flowTool
        }
      });

      availableTools = {
        ...availableTools,
        memorySaveTool: createMemorySaveTool(databaseIdHash, sessionId, storageKey, agent),
        memorySearchTool: createMemorySearchTool(databaseIdHash, sessionId, storageKey, agent),
      }
    }

    if (streamingController && agent?.agentType === 'flow') {
      const availComponentToolInstance = createAvailableUIComponentsTool(databaseIdHash);
      availableTools = {
        ...availableTools,
        availableUIComponents: availComponentToolInstance,
        traceOutputTool: createTraceTool(databaseIdHash, streamToOutput, saasContext?.isSaasMode ? saasContext.saasContex?.storageKey : null)
      }

      const availComponents = getAvailableUIComponents();

      for (const component of availComponents) {
        availableTools = {
          ...availableTools,
          ['renderUI' + component.name + 'Tool']: createRenderComponentTool(databaseIdHash, component.name, streamToOutput, component.props)
        }
      }
    }
    return availableTools;
  }
}
