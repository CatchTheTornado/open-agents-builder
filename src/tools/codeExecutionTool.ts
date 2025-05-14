import { ToolDescriptor } from './registry';
import { createCodeExecutionTool as createCodeExecutionToolFromInterpreterTools, getImageForLanguage, ContainerStrategy } from 'interpreter-tools';

export function createCodeExecutionTool(agentId: string, sessionId: string, databaseIdHash: string, storageKey: string | undefined | null): ToolDescriptor
{

  // Create the execution tool with shared workspace
  const { codeExecutionTool, executionEngine } = createCodeExecutionToolFromInterpreterTools({
    defaultStrategy: 'per_session',
    sessionId,
    verbosity: 'info',
    workspaceSharing: 'shared'
  });

  executionEngine.getContainerManager().cleanup(true, 30); // cleanup all containers older than 30m 

  return {
    displayName: 'Execute code',
    tool: codeExecutionTool
  }
}

