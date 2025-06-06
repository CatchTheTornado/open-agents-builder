import { google } from 'googleapis';
import { ToolDescriptor } from './registry';
import { tool } from 'ai';
import { z } from 'zod';
import ServerConfigRepository from '@/data/server/server-config-repository';
import { getExecutionTempDir, processFiles } from '@/lib/file-extractor';
import { writeFileSync } from 'fs';
import path, { join } from 'path';

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

interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  content?: string; // base64 content if available
  textContent?: string; // text content if available
}

interface GmailMessageDetails {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  attachments?: GmailAttachment[];
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

function saveOriginalAttachment(tempWorkspaceDir: string, name: string, base64Data: string): void {
  const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(name || '').replace('.', '').toLowerCase() || 'bin';

  // Ensure we do not duplicate file extensions if the name already contains one
  let sanitizedName = sanitize(name);
  const currentExt = path.extname(sanitizedName).replace('.', '').toLowerCase();

  // Add extension only when the sanitized name does not already include any extension
  // or includes a different one
  if (!currentExt) {
    sanitizedName = `${sanitizedName}.${ext}`;
  }

  const fileName = sanitizedName;
  const filePath = join(tempWorkspaceDir, fileName);

  try {
    let dataPart = base64Data;
    // Strip prefix if present
    if (base64Data.startsWith('data:')) {
      dataPart = base64Data.split(',')[1] ?? '';
    }
    writeFileSync(filePath, Buffer.from(dataPart, 'base64'));
  } catch (err) {
    console.error(`Error saving original attachment to ${filePath}`, err);
  }
}

function getMimeType(base64Data: string | undefined | null): string | null {
  if (!base64Data || typeof base64Data !== 'string') return null;
  // Expecting strings like: data:application/pdf;base64,JVBERi0x...
  const match = base64Data.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

export function createGmailTool(databaseIdHash: string, agentId: string, sessionId: string, storageKey: string | undefined | null): ToolDescriptor {
  return {
    displayName: 'Check Gmail',
    tool: tool({
      description: 'Access and manage Gmail emails using OAuth2 authentication',
      parameters: z.object({
        action: z.enum(['list', 'read', 'search', 'reply', 'send']).describe('The action to perform - list is the default action and lists the last emails with basic info, read reads the full content of an email, search searches for emails, reply sends a reply to an email, send sends a new email').default('list'),
        query: z.string().optional().describe('The query to perform - list, read and search only. Provide the email id for read action'),
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

              // Create temp directory for attachments
              const tempWorkspaceDir = getExecutionTempDir(databaseIdHash, agentId, sessionId);

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

              // Process attachments
              const attachments: GmailAttachment[] = [];
              const attachmentsToProcess: Record<string, string> = {};

              if (message.payload?.parts) {
                for (const part of message.payload.parts) {
                  if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
                    // Get attachment content
                    const attachmentResponse = await gmail.users.messages.attachments.get({
                      userId: 'me',
                      messageId: message.id!,
                      id: part.body.attachmentId
                    });

                    const attachmentData = attachmentResponse.data.data;
                    if (attachmentData) {
                      const base64Content = `data:${part.mimeType};base64,${attachmentData}`;
                      const sanitizedName = part.filename?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
                      
                      // Save original attachment
                      saveOriginalAttachment(tempWorkspaceDir, part.filename || 'attachment', base64Content);
                      
                      attachmentsToProcess[sanitizedName] = base64Content;
                    }
                  }
                }
              }

              // Process attachments using processFiles
              if (Object.keys(attachmentsToProcess).length > 0) {
                const processedFiles = processFiles({
                  inputObject: attachmentsToProcess,
                  pdfExtractText: true
                });

                console.log('processedFiles', processedFiles);

                // Handle processed files
                for (const [filename, content] of Object.entries(processedFiles)) {
                  const originalAttachment = message.payload?.parts?.find(
                    part => part.filename?.replace(/[^a-zA-Z0-9._-]/g, '_') === filename
                  );

                  if (originalAttachment) {
                    let mimeType: string | null = null;
                    let isImage = false;
                    
                    if (typeof content === 'string') {
                      mimeType = getMimeType(content);
                      isImage = mimeType?.startsWith('image') || false;
                    }

                    attachments.push({
                      id: originalAttachment.body?.attachmentId || '',
                      filename: originalAttachment.filename || filename,
                      mimeType: originalAttachment.mimeType || 'application/octet-stream',
                      size: originalAttachment.body?.size || 0,
                      content: isImage ? content as string : undefined,
                      textContent: !isImage ? content as string : undefined
                    });
                  }
                }
              }

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
                format: 'full'
              });

              const headers = originalMessage.data.payload?.headers || [];
              const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
              const from = headers.find(h => h.name === 'From')?.value || '';
              const references = headers.find(h => h.name === 'References')?.value || '';
              
              // Extract email address from the From field
              const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;
              
              // Create reply subject
              const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

              // Create email headers for threading
              const emailLines = [
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset="UTF-8"',
                `To: ${fromEmail}`,
                `Subject: ${replySubject}`,
                `In-Reply-To: ${originalMessage.data.id}`,
                `References: ${references ? `${references} ` : ''}${originalMessage.data.id}`,
                '',
                args.replyMessage
              ];

              const emailBody = emailLines.join('\r\n');
              
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