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

interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface GmailMessageDetails {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

interface Attachment {
  filename: string;
  mimeType: string;
  content: string; // base64 encoded content or URL
  isUrl?: boolean;
}

function createEmailBody(to: string, subject: string, message: string, attachments: Attachment[] = []): string {
  const boundary = 'foo_bar_baz';
  const emailLines = [
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    message
  ];

  // Add attachments if any
  for (const attachment of attachments) {
    emailLines.push(
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.content
    );
  }

  // Close the multipart message
  emailLines.push(`--${boundary}--`);

  return emailLines.join('\r\n');
}

async function fetchAttachmentFromUrl(url: string): Promise<{ content: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment from URL: ${url}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = await response.arrayBuffer();
  const base64Content = Buffer.from(buffer).toString('base64');

  return {
    content: base64Content,
    mimeType: contentType
  };
}

export function createGmailTool(databaseIdHash: string, agentId: string, storageKey: string | undefined | null): ToolDescriptor {
  return {
    displayName: 'Check Gmail',
    tool: tool({
      description: 'Access and manage Gmail emails using OAuth2 authentication',
      parameters: z.object({
        action: z.enum(['list', 'read', 'search', 'reply', 'send']).describe('The action to perform - list is the default action and lists the last emails with basic info, read reads the full content of an email, search searches for emails, reply sends a reply to an email, send sends a new email').default('list'),
        query: z.string().optional().describe('The query to perform - list and search only'),
        maxResults: z.number().optional().default(10).describe('The maximum number of results to return'),
        messageId: z.string().optional().describe('The ID of the email to reply to (required for reply action)'),
        replyMessage: z.string().optional().describe('The message content for the reply (required for reply action)'),
        to: z.string().optional().describe('The recipient email address (required for send action)'),
        subject: z.string().optional().describe('The email subject (required for send action)'),
        message: z.string().optional().describe('The email message content (required for send action)'),
        attachments: z.array(z.object({
          filename: z.string(),
          mimeType: z.string(),
          content: z.string().describe('Base64 encoded content or URL of the attachment'),
          isUrl: z.boolean().optional().describe('Whether the content is a URL that needs to be fetched')
        })).optional().describe('Array of attachments to include in the email')
      }),
      execute: async (args) => {
        // Get settings from config repository
        const configRepo = new ServerConfigRepository(databaseIdHash, storageKey);
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

              const messages = response.data.messages || [];
              const formattedMessages: GmailMessage[] = [];

              for (const message of messages) {
                const details = await gmail.users.messages.get({
                  userId: 'me',
                  id: message.id!,
                  format: 'metadata',
                  metadataHeaders: ['Subject', 'From', 'Date']
                });

                const headers = details.data.payload?.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
                const from = headers.find(h => h.name === 'From')?.value || '';
                const date = headers.find(h => h.name === 'Date')?.value || '';

                formattedMessages.push({
                  id: message.id!,
                  subject,
                  from,
                  date,
                  snippet: details.data.snippet || ''
                });
              }

              return {
                messages: formattedMessages,
                totalResults: response.data.resultSizeEstimate
              };
            }

            case 'read': {
              if (!args.query) {
                throw new Error('Email ID is required for read action');
              }
              response = await gmail.users.messages.get({
                userId: 'me',
                id: args.query,
                format: 'full'
              });

              const message = response.data;
              const headers = message.payload?.headers || [];
              const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
              const from = headers.find(h => h.name === 'From')?.value || '';
              const to = headers.find(h => h.name === 'To')?.value || '';
              const date = headers.find(h => h.name === 'Date')?.value || '';

              // Get message body
              let body = '';
              if (message.payload?.body?.data) {
                body = Buffer.from(message.payload.body.data, 'base64').toString();
              } else if (message.payload?.parts) {
                const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
                if (textPart?.body?.data) {
                  body = Buffer.from(textPart.body.data, 'base64').toString();
                }
              }

              // Get attachments info
              const attachments = message.payload?.parts
                ?.filter(part => part.filename && part.filename.length > 0)
                .map(part => ({
                  filename: part.filename || '',
                  mimeType: part.mimeType || '',
                  size: part.body?.size || 0
                }));

              const messageDetails: GmailMessageDetails = {
                id: message.id!,
                subject,
                from,
                to,
                date,
                body,
                attachments
              };

              return messageDetails;
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

              const messages = response.data.messages || [];
              const formattedMessages: GmailMessage[] = [];

              for (const message of messages) {
                const details = await gmail.users.messages.get({
                  userId: 'me',
                  id: message.id!,
                  format: 'metadata',
                  metadataHeaders: ['Subject', 'From', 'Date']
                });

                const headers = details.data.payload?.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
                const from = headers.find(h => h.name === 'From')?.value || '';
                const date = headers.find(h => h.name === 'Date')?.value || '';

                formattedMessages.push({
                  id: message.id!,
                  subject,
                  from,
                  date,
                  snippet: details.data.snippet || ''
                });
              }

              return {
                messages: formattedMessages,
                totalResults: response.data.resultSizeEstimate
              };
            }

            case 'reply': {
              if (!args.messageId || !args.replyMessage) {
                throw new Error('Message ID and reply message are required for reply action');
              }

              // Get the original message details
              const originalMessage = await gmail.users.messages.get({
                userId: 'me',
                id: args.messageId,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To']
              });

              const headers = originalMessage.data.payload?.headers || [];
              const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
              const from = headers.find(h => h.name === 'From')?.value || '';
              
              // Extract email address from the From field
              const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;
              
              // Create reply subject
              const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
              
              // Create email body
              const emailBody = createEmailBody(fromEmail, replySubject, args.replyMessage);
              
              // Encode the email body
              const encodedEmail = Buffer.from(emailBody)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

              // Send the reply
              response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                  raw: encodedEmail,
                  threadId: originalMessage.data.threadId
                }
              });

              return {
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId
              };
            }

            case 'send': {
              if (!args.to || !args.subject || !args.message) {
                throw new Error('To, subject, and message are required for send action');
              }

              // Process attachments if any
              const processedAttachments: Attachment[] = [];
              if (args.attachments && args.attachments.length > 0) {
                for (const attachment of args.attachments) {
                  if (attachment.isUrl) {
                    // Fetch attachment from URL
                    const { content, mimeType } = await fetchAttachmentFromUrl(attachment.content);
                    processedAttachments.push({
                      filename: attachment.filename,
                      mimeType: mimeType,
                      content: content
                    });
                  } else {
                    // Use base64 content directly
                    processedAttachments.push(attachment);
                  }
                }
              }

              // Create email body with attachments
              const emailBody = createEmailBody(args.to, args.subject, args.message, processedAttachments);
              
              // Encode the email body
              const encodedEmail = Buffer.from(emailBody)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

              // Send the email
              response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                  raw: encodedEmail
                }
              });

              return {
                success: true,
                messageId: response.data.id
              };
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