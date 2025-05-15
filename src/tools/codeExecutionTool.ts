import { ToolDescriptor } from './registry';
import { createCodeExecutionTool as createCodeExecutionToolFromInterpreterTools, getImageForLanguage, ContainerStrategy } from 'interpreter-tools';
import { getExecutionTempDir } from '@/lib/file-extractor';

export function createCodeExecutionTool(agentId: string, sessionId: string, databaseIdHash: string, storageKey: string | undefined | null): ToolDescriptor
{
  // Prepare a temp directory for persistent data shared between executions
  const tempDir = getExecutionTempDir(databaseIdHash, agentId, sessionId);

  // Create the execution tool with the additional mount and shared workspace
  const { codeExecutionTool, executionEngine } = createCodeExecutionToolFromInterpreterTools({
    mounts: [
      {
        type: 'directory',
        source: tempDir,
        target: '/session'
      }
    ],
    defaultStrategy: 'per_execution',
    sessionId,
    verbosity: 'debug',
    workspaceSharing: 'isolated'
  });

  executionEngine.getContainerManager().cleanup(true, 30); // cleanup all containers older than 30m 
  return {
    displayName: 'Execute code',
    tool: codeExecutionTool
  }
}

