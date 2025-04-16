"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import remarkGfm from 'remark-gfm';
import Markdown from "react-markdown"
import { useTranslation } from "react-i18next"
import styles from './chat.module.css';
import { ChatMessages } from "./chat-messages"
import { AttachmentUploader } from "./attachment-uploader"
import { AttachmentDTO } from "@/data/dto"

export function Chat({ headers, welcomeMessage, displayName, messages, handleInputChange, isReadonly, isLoading, handleSubmit, input  }: { headers?: Record<string, string>; displayName?: string; welcomeMessage?: string; handleInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; messages: any[]; isLoading?: boolean; isReadonly?: boolean; handleSubmit?: (e: React.FormEvent<HTMLFormElement>, options?: { headers: Record<string, string> }) => void; input?: string }) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<null | HTMLDivElement>(null)
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  const handleAttachmentUploaded = (attachment: AttachmentDTO) => {
    setAttachments(prev => [...prev, attachment]);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!handleSubmit) return;

    setIsProcessing(true);
    try {
      const processedAttachments: string[] = [];

      for (const attachment of attachments) {
        if (attachment.mimeType?.startsWith('image/')) {
          // For images, just add them directly
          processedAttachments.push(attachment.storageKey);
        } else if (attachment.mimeType === 'application/pdf') {
          // For PDFs, convert to images first
          const response = await fetch('/api/attachment/pdf2image', {
            method: 'POST',
            body: JSON.stringify({ attachmentId: attachment.id }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to process PDF');
          }
          
          const { images } = await response.json();
          processedAttachments.push(...images.map((img: string) => `data:image/png;base64,${img}`));
        }
      }

      handleSubmit(e, {
        headers: {
          ...headers,
          'x-attachments': JSON.stringify(processedAttachments),
        },
      });

      setAttachments([]);
    } catch (error) {
      console.error('Error processing attachments:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      {displayName ? (
        <CardHeader>
          <CardTitle>{displayName}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>
        <ScrollArea className="h-[60vh] pr-4">
          {welcomeMessage ? (
            <div key='welcome-message' className={`mb-4 text-left`}>
              <span className={`inline-block p-2 rounded-lg bg-muted`}>
                <Markdown className={styles.markdown} remarkPlugins={[remarkGfm]}>{welcomeMessage}</Markdown>
              </span>
            </div>
          ): null}
          <ChatMessages messages={messages} displayTimestamps={false} />
          {isLoading && (
            <div className="text-left">
              <span className="inline-block p-2 rounded-lg bg-muted">{t('AI is typing...')}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleFormSubmit} className="flex w-full space-x-2">
          {!isReadonly ? (
            <>
              <div className="flex-grow flex flex-col space-y-2">
                <Input 
                  value={input} 
                  onChange={handleInputChange} 
                  placeholder={t('Type your message...')} 
                  className="flex-grow" 
                />
                <AttachmentUploader 
                  onUploaded={handleAttachmentUploaded}
                  accept="image/*,.pdf"
                />
              </div>
              <Button type="submit" disabled={isLoading || isProcessing}>
                {t('Send')}
              </Button>
            </>
          ): null}
        </form>
      </CardFooter>
    </Card>
  )
}

