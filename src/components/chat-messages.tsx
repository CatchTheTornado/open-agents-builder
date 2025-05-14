import { Attachment, Message } from "ai";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from './chat.module.css';
import { useTranslation } from "react-i18next";
import { TimerIcon } from "lucide-react";
import { ChatMessageToolResponse } from "./chat-message-tool-response";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ImageAttachments } from './image-attachments';

export enum DisplayToolResultsMode {
    None = 'none',
    AsTextMessage = 'textmessage',
    ForUser = 'foruser'
}

export function ChatMessages({ messages, displayToolResultsMode = DisplayToolResultsMode.ForUser, displayTimestamps = false }: { messages: Message[], displayToolResultsMode?: DisplayToolResultsMode, displayTimestamps?: boolean }) {
    const { t } = useTranslation();
    return (
        messages.filter(m => m.role !== 'system' && (typeof m.content === 'string' || (m.content as unknown as Array<{ type: string, result?: string, text?: string }>).find(mc=> mc.type !== 'tool-call' && (mc.text !== '' || mc.result)))).map((m) => (
            <div key={m.id} className={`mb-4 ${m.role === "user" ? "text-right" : "text-left"}`}>
                {displayTimestamps && m.createdAt ? (<span><TimerIcon className="w-4 h-4"/>{new Date(m.createdAt).toLocaleString()}</span>) : null}
                <span
                    className={`inline-block p-2 rounded-lg ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                >
                    {m.toolInvocations && displayToolResultsMode !== DisplayToolResultsMode.None ? (
                        <div className="mb-2">
                            {m.toolInvocations.filter(tl=>tl.state === 'result').map((tl) => {
                                const isStdIOResult = tl.result && typeof tl.result === 'object' && ('stdout' in (tl.result as any) || 'stderr' in (tl.result as any));
                                if (displayToolResultsMode === DisplayToolResultsMode.ForUser && isStdIOResult) {
                                    return (
                                        <div key={tl.toolCallId} className="mb-2">
                                            <span className="font-bold">{t('Code Execution')}</span>
                                            { (tl.result as any).stdout && <ChatMessageMarkdown className="mt-1" copyToCC={false}>{`STDOUT:\n${(tl.result as any).stdout}`}</ChatMessageMarkdown> }
                                            { (tl.result as any).stderr && <ChatMessageMarkdown className="mt-1" copyToCC={false}>{`STDERR:\n${(tl.result as any).stderr}`}</ChatMessageMarkdown> }
                                        </div>
                                    )
                                }

                                return (
                                    <div key={tl.toolCallId} className="mb-2">
                                        <span className="font-bold">{t('Tool response: ')}</span>
                                        <span className="ml-2">{tl.result ? (typeof tl.result === 'string' ? (<ChatMessageMarkdown>{t(tl.result)}</ChatMessageMarkdown>) : (<ChatMessageToolResponse args={(tl as any).args} result={tl.result} />)) : t('N/A') }</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    {m.experimental_attachments && (
                        <ImageAttachments attachments={m.experimental_attachments as Attachment[]} />
                    )}
                    {(m as any).prev_sent_attachments && (
                        <ImageAttachments attachments={(m as any).prev_sent_attachments as Attachment[]} />
                    )}
                    {m.content && typeof m.content === 'string' ? (
                        <ChatMessageMarkdown>{m.content}</ChatMessageMarkdown>
                    ) : (
                        Array.isArray(m.content) && (m.content as Array<{ type: string, result?: string, text?: string }>).map((c) => {
                            if (c.type === 'text' && c.text) return (<ChatMessageMarkdown key={c.text}>{c.text}</ChatMessageMarkdown>)
                            if (c.type === 'tool-result' && c.result && displayToolResultsMode !== DisplayToolResultsMode.None) {
                                const isStdIOResult = typeof c.result === 'object' && ('stdout' in (c.result as any) || 'stderr' in (c.result as any));
                                if (displayToolResultsMode === DisplayToolResultsMode.ForUser && isStdIOResult) {
                                    return (
                                        <div className="mb-2" key={c.text}>
                                            <span className="font-bold">{t('Code Execution')}</span>
                                            { (c.result as any).stdout && <ChatMessageMarkdown className="mt-1" copyToCC={false}>{`STDOUT:\n${(c.result as any).stdout}`}</ChatMessageMarkdown> }
                                            { (c.result as any).stderr && <ChatMessageMarkdown className="mt-1" copyToCC={false}>{`STDERR:\n${(c.result as any).stderr}`}</ChatMessageMarkdown> }
                                        </div>
                                    )
                                }

                                return (
                                    <div className="mb-2" key={c.text}>
                                        <span className="font-bold">{t('Tool response: ')}</span>
                                        {(typeof c.result === 'string' ? 
                                            (<ChatMessageMarkdown>{t(c.result)}</ChatMessageMarkdown>) : 
                                            (<ChatMessageToolResponse args={(c as any).args} result={c.result} />)
                                        )}                            
                                    </div>
                                )
                            }
                        })
                    )}
                </span>
            </div>
        ))
    );
}