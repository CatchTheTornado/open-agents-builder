import { z } from 'zod';
import { tool } from 'ai';
import { ResultDTO } from '@/data/dto';
import ServerResultRepository from '@/data/server/server-result-repository';
import { ToolDescriptor } from './registry';
import ServerSessionRepository from '@/data/server/server-session-repository';

export function createUpdateResultTool(databaseIdHash: string): ToolDescriptor
{
  return {
  displayName: 'Sage result',
  tool:tool({
          description: 'Save results',
          parameters: z.object({
            sessionId: z.string().describe('The result/session ID to be updated'),
            format: z.string().describe('The format of the inquiry results (requested by the user - could be: JSON, markdown, text etc.)'),
            result: z.string().describe('The inquiry results - in different formats (requested by the user - could be JSON, markdown, text etc.)'),
          }),
          execute: async ({ sessionId, result, format }) => {
            try {
              const resultRepo = new ServerResultRepository(databaseIdHash);
              const sessionsRepo = new ServerSessionRepository(databaseIdHash);
              const existingSession = await sessionsRepo.findOne({ id: sessionId });

              if(!existingSession) {
                return 'Session not found, please check the sessionId';
              }

              const storedResult = {
                sessionId,
                agentId: existingSession?.agentId,
                userEmail: existingSession?.userEmail,
                userName: existingSession?.userName,
                createdAt: new Date().toISOString()
              } as ResultDTO;

              console.log(existingSession);
              console.log(storedResult);
            
              storedResult.updatedAt = new Date().toISOString();
              storedResult.finalizedAt = new Date().toISOString();
              storedResult.content = result;
              storedResult.format = format;      
              await sessionsRepo.upsert({ id: sessionId }, { ...existingSession, finalizedAt: new Date().toISOString() });
              await resultRepo.upsert({ sessionId }, storedResult);
              return 'Results saved!';
            } catch (e) {
              console.error(e);
              return 'Error saving results';
            }
          },
        }),
      }
    }

