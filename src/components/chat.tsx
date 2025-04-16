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
import { PaperclipIcon } from "./icons"
import { TrashIcon } from "lucide-react"

export function Chat({ headers, welcomeMessage, displayName, messages, handleInputChange, isReadonly, isLoading, handleSubmit, input }: { headers?: Record<string, string>; displayName?: string; welcomeMessage?: string; handleInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; messages: any[]; isLoading?: boolean; isReadonly?: boolean; handleSubmit?: (e: React.FormEvent<HTMLFormElement>, options?: { headers: Record<string, string>, experimental_attachments: FileList | undefined }) => void; input?: string }) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<null | HTMLDivElement>(null)
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);


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
              <span
                className={`inline-block p-2 rounded-lg bg-muted`}
              >
                <Markdown className={styles.markdown} remarkPlugins={[remarkGfm]}>{welcomeMessage}</Markdown>
              </span>
            </div>
          ) : null}
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
        <form
          onSubmit={event => {
            if (handleSubmit)
              handleSubmit(event, {
                headers: headers ?? {},
                experimental_attachments: files,
              });

            if (input) {
              setFiles(undefined);

              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }
          }}
          className="flex flex-col w-full space-y-2"
        >
          {!isReadonly ? (
            <>
              {files && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(files).map((file, index) => (
                    <div key={index} className="flex items-center space-x-2 bg-muted p-2 rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          const removeFile = (prvFiles: FileList) => {
                            const updatedFiles = Array.from(prvFiles).filter((_, i) => i !== index)
                            const dt = new DataTransfer();
                            updatedFiles.forEach(file => dt.items.add(file));
                            return dt.files;
                          }

                          setFiles(prvFiles => prvFiles ? removeFile(prvFiles) : undefined);
                        }}
                        className=""
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder={t('Type your message...')}
                  className="flex-grow"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center"
                >
                  <PaperclipIcon />
                </Button>
                <Input
                  type="file"
                  className="hidden"
                  onChange={event => {
                    if (event.target.files) {
                      const dt = new DataTransfer();
                      if (files) {
                        Array.from(files).forEach(file => dt.items.add(file));
                      }
                      Array.from(event.target.files).forEach(file => dt.items.add(file));
                      setFiles(dt.files);
                    } else {
                      setFiles(event.target.files);
                    }
                  }}
                  multiple
                  ref={fileInputRef}
                />
                <Button type="submit" disabled={isLoading}>
                  {t('Send')}
                </Button>
              </div>
            </>
          ) : null}
        </form>
      </CardFooter>
    </Card>
  )
}
