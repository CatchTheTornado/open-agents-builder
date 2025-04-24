import { z } from 'zod';
import { tool } from 'ai';
import ServerCalendarRepository from '@/data/server/server-calendar-repository';
import { ToolDescriptor } from './registry';

export function createCalendarListTool(agentId: string, sessionId: string, databaseIdHash: string, storageKey: string | undefined | null, alwaysFullVisibility: boolean = false): ToolDescriptor
{
  return {
    displayName: 'Access events calendar',
    tool: tool({
      description: 'List all events in the calendar. Always list events BEFORE SCHEDULING new one to check the availability.',
      parameters: z.object({
        limitedVisibility: z.coerce.boolean().optional().default(false).describe('If the events should be anonymized - by default should be false unless instructed otherwise'),
      }),
      execute: async ({ limitedVisibility }) => {
        try {
          const eventsRepo = new ServerCalendarRepository(databaseIdHash, storageKey);
          const response =  await eventsRepo.findAll({
            filter: {
              agentId
            }
          })

          if (response && response.length > 0 && (limitedVisibility && !alwaysFullVisibility)) {
            return response.map(evt => {
              return { ...evt, description: 'ANONYMIZED', location: 'ANONYMIZED', participants: [], title: 'ANONYMIZED' }
            })
          }

          return response;
        } catch (e) {
          console.error(e);
          return 'Event list failed';
        }
      },
    }),
  }
}

