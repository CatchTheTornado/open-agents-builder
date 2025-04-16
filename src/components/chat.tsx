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

export function Chat({ headers, welcomeMessage, displayName, messages, handleInputChange, isReadonly, isLoading, handleSubmit, input  }: { headers?: Record<string, string>; displayName?: string; welcomeMessage?: string; handleInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; messages: any[]; isLoading?: boolean; isReadonly?: boolean; handleSubmit?: (e: React.FormEvent<HTMLFormElement>, options?: { headers: Record<string, string> }) => void; input?: string }) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<null | HTMLDivElement>(null)

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
        <form onSubmit={e=> {
          if (handleSubmit)
          {
            handleSubmit(e, {
              headers: headers ?? {}
            })
          }
        }} className="flex w-full space-x-2">
          {!isReadonly ? (
            <>
              <Input value={input} onChange={handleInputChange} placeholder={t('Type your message...')} className="flex-grow" />
              <Button type="submit" disabled={isLoading}>
                {t('Send')}
              </Button>
            </>
          ): null}
        </form>
      </CardFooter>
    </Card>
  )
}

