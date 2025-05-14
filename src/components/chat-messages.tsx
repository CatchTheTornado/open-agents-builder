/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client';
import React from 'react';
import { Attachment, Message } from "ai";
// @ts-ignore
import SyntaxHighlighter from 'react-syntax-highlighter';
import { useTranslation } from "react-i18next";
import { TimerIcon } from "lucide-react";
import { ChatMessageToolResponse } from "./chat-message-tool-response";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ImageAttachments } from './image-attachments';
import Link from 'next/link';

export enum DisplayToolResultsMode {
    None = 'none',
    AsTextMessage = 'textmessage',
    ForUser = 'foruser',
    ForEasyUser = 'forEasyUser'
}

interface ChatMessagesProps {
    messages: Message[];
    displayToolResultsMode?: DisplayToolResultsMode;
    displayTimestamps?: boolean;
    sessionId?: string;
    databaseIdHash?: string;
}

export function ChatMessages({ messages, displayToolResultsMode = DisplayToolResultsMode.ForEasyUser, displayTimestamps = false, sessionId, databaseIdHash }: ChatMessagesProps) {
    const { t } = useTranslation();

    // cache of files per message id
    const [filesCache, setFilesCache] = React.useState<Record<string, string[]>>({});

    // helper: determine if message contains code-execution stdout/stderr results
    const hasStdIO = React.useCallback((msg: Message) => {
        // check toolInvocations first
        if ((msg as any).toolInvocations) {
            if ((msg as any).toolInvocations.some((tl: any) => tl.state === 'result' && tl.result && typeof tl.result === 'object' && ('stdout' in tl.result || 'stderr' in tl.result))) {
                return true;
            }
        }
        // then check content blocks
        if (Array.isArray(msg.content)) {
            if ((msg.content as any).some((c: any) => c.type === 'tool-result' && c.result && typeof c.result === 'object' && ('stdout' in c.result || 'stderr' in c.result))) {
                return true;
            }
        }
        return false;
    }, []);

    const fetchDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        if (!sessionId) return;

        const msgsToFetch = messages.filter((m) => hasStdIO(m) && !filesCache[m.id]);
        if (msgsToFetch.length === 0) return;

        // Clear any existing scheduled fetch
        if (fetchDebounceRef.current) {
            clearTimeout(fetchDebounceRef.current);
        }

        // Schedule a debounced fetch (500ms)
        fetchDebounceRef.current = setTimeout(() => {
            (async () => {
                try {
                    const res = await fetch(`/storage/session/${databaseIdHash}/${sessionId}/files`);
                    if (!res.ok) return;
                    const files: string[] = await res.json();
                    setFilesCache((prev) => {
                        const updated = { ...prev };
                        msgsToFetch.forEach((msg) => {
                            updated[msg.id] = files;
                        });
                        return updated;
                    });
                } catch (err) {
                    console.error('Error fetching session files', err);
                }
            })();
        }, 500); // debounce delay in ms

        // Cleanup if component unmounts or dependencies change before timeout triggers
        return () => {
            if (fetchDebounceRef.current) {
                clearTimeout(fetchDebounceRef.current);
            }
        };
    }, [messages, sessionId, databaseIdHash, filesCache, hasStdIO]);

    // helper to render list of files for specific message
    const renderSessionFiles = (messageId: string) => {
        if (!sessionId || !filesCache[messageId] || filesCache[messageId].length === 0) {
            return null;
        }
        return (
            <div className="mt-2 overflow-x-scroll">
                <div className="font-bold">📂 {t('Files')}</div>
                <ul className="list-disc list-inside">
                    {filesCache[messageId].map((file) => (
                        <li key={file}>
                            <Link className="underline text-primary" href={`/storage/session/${databaseIdHash}/${sessionId}/file?name=${encodeURIComponent(file)}`} target="_blank">
                                {file}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

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
                                if ((displayToolResultsMode === DisplayToolResultsMode.ForUser || displayToolResultsMode === DisplayToolResultsMode.ForEasyUser) && isStdIOResult) {
                                    if (displayToolResultsMode === DisplayToolResultsMode.ForEasyUser) {
                                        return (
                                            <div key={tl.toolCallId} className="mb-2">
                                                <span className="font-bold">{ (tl.result as any).stderr ? '❌ ' + t('Code executed with errors. Please try again') : '✅ ' + t('Code execution succeeded') }</span>
                                                {renderSessionFiles(m.id)}
                                            </div>
                                        )
                                    }
                                    return (
                                        <div key={tl.toolCallId} className="mb-2">
                                            <span className="font-bold">{t('Code Execution')}</span>
                                            { (tl as any).args?.code && (
                                                <div className="mt-2  overflow-x-scroll">
                                                    <div className="font-bold">💻 {t('Code')}</div>
                                                    {/* @ts-ignore */}
                                                    <SyntaxHighlighter 
                                                        language={(tl as any).args?.language ?? 'bash'} 
                                                        wrapLines={true} 
                                                        wrapLongLines={true}
                                                        customStyle={{ overflowX: 'auto', maxWidth: '36rem', width: '100%' }}>
                                                        {(tl as any).args?.code}
                                                    </SyntaxHighlighter>
                                                </div>
                                            ) }
                                                    { (tl.result as any).stdout && (
                                                        <div className="mt-2 overflow-x-scroll">
                                                            <div className="font-bold">📤 {t('Output')}</div>
                                                            {/* @ts-ignore */}
                                                            <SyntaxHighlighter language="bash" wrapLines={true} wrapLongLines={true} customStyle={{ overflowX: 'auto', maxWidth: '36rem', width: '100%' }}>
                                                                {(tl.result as any).stdout}
                                                            </SyntaxHighlighter>
                                                        </div>) }
                                                    { (tl.result as any).stderr && (
                                                        <div className="mt-2  overflow-x-scroll">
                                                            <div className="font-bold">❌ {t('Errors')}</div>
                                                            {/* @ts-ignore */}
                                                            <SyntaxHighlighter language="bash" wrapLines={true} wrapLongLines={true} customStyle={{ overflowX: 'auto', maxWidth: '36rem', width: '100%' }}>
                                                                {(tl.result as any).stderr}
                                                            </SyntaxHighlighter>
                                                        </div>) }
                                            {renderSessionFiles(m.id)}
                                        </div>
                                    )
                                }

                                if (displayToolResultsMode === DisplayToolResultsMode.ForUser) {
                                    // Skip non-code-execution results in ForUser mode
                                    return null;
                                }

                                if (displayToolResultsMode === DisplayToolResultsMode.ForEasyUser) {
                                    // skip all non-stdio results
                                    return null;
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
                                if ((displayToolResultsMode === DisplayToolResultsMode.ForUser || displayToolResultsMode === DisplayToolResultsMode.ForEasyUser) && isStdIOResult) {
                                    if (displayToolResultsMode === DisplayToolResultsMode.ForEasyUser) {
                                        return (
                                            <div className="mb-2" key={c.text}>
                                                <span className="font-bold">{ (c.result as any).stderr ? '❌ ' + t('Code executed with errors. Please try again') : '✅ ' + t('Code execution succeeded') }</span>
                                                {renderSessionFiles(m.id)}
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="mb-2" key={c.text}>
                                            <span className="font-bold">{t('Code Execution')}</span>
                                            { (c as any).args?.code && (
                                                <div className="mt-2  overflow-x-scroll">
                                                    <div className="font-bold">💻 {t('Code')}</div>
                                                    {/* @ts-ignore */}
                                                    <SyntaxHighlighter 
                                                        language={(c as any).args?.language ?? 'bash'} 
                                                        wrapLines={true} 
                                                        wrapLongLines={true}
                                                        customStyle={{ overflowX: 'auto', maxWidth: '36rem', width: '100%' }}>
                                                        {(c as any).args?.code}
                                                    </SyntaxHighlighter>
                                                </div>
                                            ) }
                                                    { (c.result as any).stdout && (
                                                        <div className="mt-2 overflow-x-scroll">
                                                            <div className="font-bold">📤 {t('Output')}</div>
                                                            {/* @ts-ignore */}
                                                            <SyntaxHighlighter language="bash" wrapLines={true} wrapLongLines={true} customStyle={{ overflowX: 'auto', maxWidth: '36rem', width: '100%' }}>
                                                                {(c.result as any).stdout}
                                                            </SyntaxHighlighter>
                                                        </div>) }
                                                    { (c.result as any).stderr && (
                                                        <div className="mt-2 overflow-x-scroll">
                                                            <div className="font-bold">❌ {t('Errors')}</div>
                                                            {/* @ts-ignore */}
                                                            <SyntaxHighlighter language="bash" wrapLines={true} wrapLongLines={true} customStyle={{ overflowX: 'auto', maxWidth: '36rem', width: '100%' }}>
                                                                {(c.result as any).stderr}
                                                            </SyntaxHighlighter>
                                                        </div>) }
                                            {renderSessionFiles(m.id)}
                                        </div>
                                    )
                                }

                                if (displayToolResultsMode === DisplayToolResultsMode.ForUser) {
                                    // Skip non-code-execution results in ForUser mode
                                    return null;
                                }

                                if (displayToolResultsMode === DisplayToolResultsMode.ForEasyUser) {
                                    return null;
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