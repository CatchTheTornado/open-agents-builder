import { google } from 'googleapis';
import { ToolDescriptor } from './registry';
import { tool } from 'ai';
import { z } from 'zod';
import ServerConfigRepository from '@/data/server/server-config-repository';

interface GmailToolSettings {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}

export function createCheckGmailTool(databaseIdHash: string, agentId: string): ToolDescriptor {
  return {
    displayName: 'Check Gmail',
    tool: tool({
      description: 'Access and manage Gmail emails using OAuth2 authentication',
      parameters: z.object({
        action: z.enum(['list', 'read', 'search']),
        query: z.string().optional(),
        maxResults: z.number().optional().default(10)
      }),
      execute: async (args) => {
        // Get settings from config repository
        const configRepo = new ServerConfigRepository(databaseIdHash);
        const settings = await getGmailSettings(configRepo, agentId);
        if (!settings) {
          throw new Error('Gmail settings not found. Please configure Gmail access first.');
        }

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        // Set credentials from stored settings
        oauth2Client.setCredentials({
          access_token: settings.accessToken,
          refresh_token: settings.refreshToken,
          expiry_date: settings.expiryDate
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        try {
          let response;
          switch (args.action) {
            case 'list': {
              response = await gmail.users.messages.list({
                userId: 'me',
                maxResults: args.maxResults || 10,
                q: args.query || 'in:inbox'
              });
              return response.data;
            }

            case 'read': {
              if (!args.query) {
                throw new Error('Email ID is required for read action');
              }
              response = await gmail.users.messages.get({
                userId: 'me',
                id: args.query
              });
              return response.data;
            }

            case 'search': {
              if (!args.query) {
                throw new Error('Search query is required for search action');
              }
              response = await gmail.users.messages.list({
                userId: 'me',
                maxResults: args.maxResults || 10,
                q: args.query
              });
              return response.data;
            }

            default:
              throw new Error('Invalid action specified');
          }
        } catch (error) {
          console.error('Gmail API Error:', error);
          throw new Error('Failed to execute Gmail operation');
        }
      }
    })
  };
}

async function getGmailSettings(configRepo: ServerConfigRepository, agentId: string): Promise<GmailToolSettings | null> {
  try {
    const config = await configRepo.findAll();
    const gmailConfig = config.find(c => c.key === `gmail_settings_${agentId}`);
    if (!gmailConfig?.value) {
      return null;
    }
    return JSON.parse(gmailConfig.value) as GmailToolSettings;
  } catch (error) {
    console.error('Failed to get Gmail settings:', error);
    return null;
  }
} 