// tools/index.ts
import { SendEmailConfigurator } from './sendEmailTool-configurator';
import { CurrentDateConfigurator } from './currentDateTool-configurator';
import { CalendarListConfigurator } from './calendarListTool-configurator';
import { CalendarScheduleConfigurator } from './calendarScheduleTool-configurator';
import { DayNameConfigurator } from './dayNameTool-configurator';
import { CreateOrderToolConfigurator } from './createOrderTool-configurator';
import { ListProductsConfigurator } from './listProductsTool-configurator';
import { HttpConfigurator } from './httpTool-configurator';
import { AttachmentContentConfigurator } from './attachmentContentTool-configurator';
import { ListAttachmentsConfigurator } from './listAttachmentsTool-configurator';
import { UpdateResultToolConfigurator } from './updateResultTool-configurator';
import { ExecFlowToolConfigurator } from './execFlowTool-configurator';
import { Agent } from '@/data/client/models';
import { TraceToolConfigurator } from './traceTool-configurator';
import { RenderComponentToolConfigurator } from './renderComponentTool-configurator';
import { getAvailableUIComponents } from './availableUIComponentsTool';
import { MemoryStoreConfigurator } from './memoryStore-configurator';
import { MemorySearchConfigurator } from './memorySearch-configurator';
import { CodeExecutionToolConfigurator } from './codeExecutionTool-configurator';

type ToolConfiguratorDescriptor = {
  displayName: string;
  configurator: React.ComponentType<{ options: any; onChange: (options: any) => void }>;
  defaultOptions?: Record<string, unknown>;
}

export const toolConfiguratorsRepository = {
  init: ({ agent }: { agent?: Agent }): Record<string, ToolConfiguratorDescriptor> => {

    let configurators: Record<string, ToolConfiguratorDescriptor> = {
      sendEmail: {
        displayName: 'Send Email',
        configurator: SendEmailConfigurator
      },
      currentDate: {
        displayName: 'Get current date',
        configurator: CurrentDateConfigurator
      },
      calendarList: {
        displayName: 'Access events calendar',
        configurator: CalendarListConfigurator
      },
      calendarSchedule: {
        displayName: 'Schedule events',
        configurator: CalendarScheduleConfigurator
      },
      dayName: {
        displayName: 'Get the day name',
        configurator: DayNameConfigurator
      },
      createOrderTool: {
        displayName: 'Create order',
        configurator: CreateOrderToolConfigurator
      },
      listProducts: {
        displayName: 'List products',
        configurator: ListProductsConfigurator
      },
      httpTool: {
        displayName: 'HTTP Requests',
        configurator: HttpConfigurator
      },
      attachmentContent: {
        displayName: 'Attachment Content',
        configurator: AttachmentContentConfigurator
      },
      listAttachments: {
        displayName: 'List Attachments',
        configurator: ListAttachmentsConfigurator
      },
      updateResultTool: {
        displayName: 'Update Result',
        configurator: UpdateResultToolConfigurator
      },
      memorySaveTool: {
        displayName: "Memory/vector save",
        configurator: MemoryStoreConfigurator,
        defaultOptions: {
          storeName: "default"
        }
      },
      memorySearchTool: {
        displayName: "Memory/vector search",
        configurator: MemorySearchConfigurator,
        defaultOptions: {
          storeName: "default"
        }
      },
      codeExecutionTool: {
        displayName: "Code Execution",
        configurator: CodeExecutionToolConfigurator
      }
    }

    if (agent && agent.agentType === 'flow') {
      configurators = {
        ...configurators,
        traceOutputTool: {
          displayName: 'Trace Output',
          configurator: TraceToolConfigurator
        },
        availableUIComponents: {
          displayName: 'Available UI Components',
          configurator: TraceToolConfigurator
        },
      }

      const availComponents = getAvailableUIComponents();

      for (const component of availComponents) {
        configurators = {
          ...configurators,
          ['renderUI' + component.name + 'Tool']: {
            displayName: 'Render ' + component.displayName + ' component',
            configurator: RenderComponentToolConfigurator
          }
        }
      }
    }

    if (agent) {

      (agent.flows ?? []).forEach(flow => {
        configurators = {
          ...configurators,
          ['flowTool' + flow.code]: {
            displayName: 'Execute ' + flow.name + ' flow',
            configurator: ExecFlowToolConfigurator
          }
        }
      });
    }



    return configurators;
  }
}