'use client';

import React, { useContext, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgentContext } from '@/contexts/agent-context';
import { DatabaseContext } from '@/contexts/db-context';
import { useKeyContext } from '@/contexts/key-context';
import { AgentApiClient, TestCase } from '@/data/client/agent-api-client';
import { useState } from 'react';
import { Plus, Play, Loader2, Wand2, Trash2, RefreshCw, ChevronDown, ChevronRight, MessageSquare, Download, Upload } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { ChatMessageMarkdown } from '@/components/chat-message-markdown';
import { nanoid } from 'nanoid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { onAgentSubmit } from '../general/page';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { AgentStatus } from '@/components/layout/agent-status';

interface Evaluation {
  isCompliant: boolean;
  explanation: string;
  score: number;
}

interface ConversationFlow {
  messages: {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: {
      toolName: string;
      args: Record<string, unknown>;
      result: any;
    }[];
  }[];
  toolCalls?: {
    name: string;
    arguments: Record<string, unknown>;
  }[];
}

interface ExtendedTestCase extends TestCase {
  evaluation?: Evaluation;
  conversationFlow?: ConversationFlow;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'TX' | 'RX';
  statusColor?: string;
  statusSpinner?: boolean;
}

export default function AgentEvalsPage() {
  const { t } = useTranslation();
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>({});
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const agentContext = useAgentContext();
  const dbContext = useContext(DatabaseContext);
  const keyContext = useKeyContext();
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [adjustingCaseId, setAdjustingCaseId] = useState<string | null>(null);
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null);

  const { current: agent, dirtyAgent, status, updateAgent } = useAgentContext(); // 'dirtyAgent' is unused, but keep for future use
  const router = useRouter(); 
  const { register, handleSubmit, setValue, getValues, watch, formState: { errors }, setError } = useForm({
    defaultValues: agent ? agent.toForm(null) : {},
  });

  const { onSubmit, isDirty } = onAgentSubmit(agent, watch, setValue, getValues, updateAgent, t, router, {});
  const agentEvals = watch('evals') as TestCase[];
  const [testCases, setTestCases] = useState<ExtendedTestCase[]>(agentEvals || []);


  register('evals');
  const [selectedConversation, setSelectedConversation] = useState<ConversationFlow | null>(null);


  useEffect(() => {
    if (testCases && initialLoadDone) {
      setValue('evals', testCases)
    }
  }, [testCases, initialLoadDone]);

  useEffect(() => {
    if (agentEvals && agentEvals.length > 0 &&  !initialLoadDone) {
      setTestCases(agentEvals)
      setInitialLoadDone(true);
    }
  }, [agentEvals, initialLoadDone]);

  const generateTestCases = async () => {
    if (!agentContext.current?.prompt || !agentContext.current?.id) return;

    try {
      setIsGeneratingTests(true);
      const client = new AgentApiClient(
        process.env.NEXT_PUBLIC_API_URL || '',
        dbContext,
        null
      );

      const result = await client.generateTestCases(
        agentContext.current.id,
        agentContext.current.prompt
      );

      if (result.testCases) {
        setTestCases(result.testCases);
      }
    } catch (error) {
      console.error('Failed to generate test cases:', error);
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const runEvals = async () => {
    if (!agentContext.current?.id) return;

    let keyData: string | undefined;
    try {
      const client = new AgentApiClient(
        process.env.NEXT_PUBLIC_API_URL || '',
        dbContext
      );

      for await (const data of client.runEvalsStream(agentContext.current.id, testCases)) {
        switch (data.type) {
          case 'test_case_update':
            setTestCases(prev => 
              prev.map(tc => 
                tc.id === data.data.id ? { ...tc, ...data.data } : tc
              )
            );
            break;
          case 'test_case_error':
            setTestCases(prev => 
              prev.map(tc => 
                tc.id === data.data.id ? { ...tc, ...data.data } : tc
              )
            );
            break;
          case 'error':
            throw new Error(data.error);
        }
      }
    } catch (error) {
      console.error('Failed to run evaluations:', error);
    } finally {
      if (keyData) {
        keyContext.removeKeyByName(keyData);
      }
    }
  };

  const removeTestCase = (testCaseId: string) => {
    setTestCases(prev => prev.filter(tc => tc.id !== testCaseId));
    setExpandedCases(prev => {
      const newSet = { ...prev };
      delete newSet[testCaseId];
      return newSet;
    });
    if (selectedCase === testCaseId) {
      setSelectedCase(null);
    }
  };

  const toggleExpand = (id: string) => {
    setSelectedCase(id);
    setExpandedCases(prev => {
      const newSet = { ...prev };
      newSet[id] = !newSet[id];
      return newSet;
    });
  };

  const addMessage = (testCaseId: string) => {
    setTestCases(prev => {
      const newCases = [...prev];
      const index = newCases.findIndex(tc => tc.id === testCaseId);
      newCases[index].messages.push({
        role: 'user',
        content: ''
      });
      return newCases;
    });
  };

  const updateMessage = (testCaseId: string, messageIndex: number, content: string) => {
    setTestCases(prev => {
      const newCases = [...prev];
      const index = newCases.findIndex(tc => tc.id === testCaseId);
      newCases[index].messages[messageIndex].content = content;
      return newCases;
    });
  };

  const removeMessage = (testCaseId: string, messageIndex: number) => {
    setTestCases(prev => {
      const newCases = [...prev];
      const index = newCases.findIndex(tc => tc.id === testCaseId);
      newCases[index].messages = newCases[index].messages.filter((_, i) => i !== messageIndex);
      return newCases;
    });
  };

  const updateMessageRole = (testCaseId: string, messageIndex: number, role: 'user' | 'assistant') => {
    setTestCases(prev => {
      const newCases = [...prev];
      const index = newCases.findIndex(tc => tc.id === testCaseId);
      newCases[index].messages[messageIndex].role = role;
      return newCases;
    });
  };

  const adjustCaseToResult = async (testCase: ExtendedTestCase) => {
    if (!agentContext.current?.id || !testCase.actualResult) return;
    setAdjustingCaseId(testCase.id);
    try {
      const client = new AgentApiClient(
        process.env.NEXT_PUBLIC_API_URL || '',
        dbContext
      );
      const result = await client.adjustTestCase(
        agentContext.current.id,
        testCase.id,
        testCase.actualResult
      );
      if (result.testCase) {
        setTestCases(prev => 
          prev.map(tc => 
            tc.id === testCase.id ? { ...tc, ...result.testCase } : tc
          )
        );
      }
    } catch (error) {
      console.error('Failed to adjust test case:', error);
    } finally {
      setAdjustingCaseId(null);
    }
  };

  const addTestCase = () => {
    const newTestCase: ExtendedTestCase = {
      id: nanoid(),
      messages: [
        {
          role: 'user',
          content: ''
        }
      ],
      expectedResult: '',
      status: 'pending'
    };
    setTestCases(prev => [...prev, newTestCase]);
    setSelectedCase(newTestCase.id);
    setExpandedCases(prev => {
      const newSet = { ...prev };
      newSet[newTestCase.id] = true;
      return newSet;
    });
  };

  const runSingleEval = async (testCase: ExtendedTestCase) => {
    if (!agentContext.current?.id) return;
    setRunningCaseId(testCase.id);
    try {
      const client = new AgentApiClient(
        process.env.NEXT_PUBLIC_API_URL || '',
        dbContext
      );
      for await (const data of client.runEvalsStream(agentContext.current.id, [testCase])) {
        switch (data.type) {
          case 'test_case_update':
            setTestCases(prev =>
              prev.map(tc =>
                tc.id === data.data.id ? { ...tc, ...data.data } : tc
              )
            );
            break;
          case 'test_case_error':
            setTestCases(prev =>
              prev.map(tc =>
                tc.id === data.data.id ? { ...tc, ...data.data } : tc
              )
            );
            break;
          case 'error':
            throw new Error(data.error);
        }
      }
    } catch (error) {
      console.error('Failed to run evaluation:', error);
    } finally {
      setRunningCaseId(null);
    }
  };

  const exportTestCases = () => {
    const dataStr = JSON.stringify(testCases, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'test-cases.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importTestCases = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedCases = JSON.parse(content);
        setTestCases(importedCases);
      } catch (error) {
        console.error('Failed to import test cases:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {isDirty ? (
        <AgentStatus status={{ id: 'dirty', message: t('You have unsaved changes'), type: 'warning' }} />
      ) : (
        <AgentStatus status={status} />
      )}

      <div className="flex space-x-4 ">
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" onClick={generateTestCases} disabled={isGeneratingTests}>
                {isGeneratingTests ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('Generating...')}
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    {t('Generate Test Cases')}
                  </>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={addTestCase}>
                <Plus className="mr-2 h-4 w-4" />
                {t('Add Test Case')}
              </Button>
              <Button size="sm" variant="outline" onClick={runEvals} disabled={testCases.length === 0}>
                <Play className="mr-2 h-4 w-4" />
                {t('Run Evals')}
              </Button>
              <Button size="sm" variant="outline" onClick={exportTestCases} disabled={testCases.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {t('Export JSON')}
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={importTestCases}
                  className="hidden"
                  id="import-test-cases"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => document.getElementById('import-test-cases')?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {t('Import JSON')}
                </Button>
              </div>
            </div>
      </div>
      <div className="mt-6">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="max-w-[200px]">{t('First Message')}</TableHead>
                <TableHead className="max-w-[200px]">{t('Expected Result')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead className="max-w-[200px]">{t('Actual Result')}</TableHead>
                <TableHead className="max-w-[200px]">{t('Evaluation')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCase) => (
                <React.Fragment key={testCase.id}>
                  <TableRow
                    className={selectedCase === testCase.id ? 'bg-muted' : ''}
                    onClick={() => toggleExpand(testCase.id)}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(testCase.id);
                        }}
                      >
                        {expandedCases[testCase.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="max-w-[200px] break-words">
                      {testCase.messages[0]?.content || ''}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <Textarea
                        value={testCase.expectedResult}
                        onChange={e => {
                          setTestCases(prev => {
                            const newCases = [...prev];
                            const index = newCases.findIndex(tc => tc.id === testCase.id);
                            newCases[index].expectedResult = e.target.value;
                            return newCases;
                          });
                        }}
                        placeholder={t('Expected result...')}
                        onClick={e => e.stopPropagation()}
                        disabled={testCase.status === 'running'}
                        className="resize-none"
                      />
                    </TableCell>
                    <TableCell>
                      {testCase.status === 'running' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="space-y-2">
                          <Badge
                            variant={
                              testCase.status === 'completed'
                                ? testCase.evaluation?.isCompliant
                                  ? 'default'
                                  : 'destructive'
                                : testCase.status === 'failed'
                                ? 'destructive'
                                : testCase.status === 'TX'
                                ? 'outline'
                                : testCase.status === 'RX'
                                ? 'outline'
                                : 'secondary'
                            }
                            className={
                              testCase.status === 'completed' && testCase.evaluation?.isCompliant
                                ? 'bg-green-500 hover:bg-green-600'
                                : testCase.status === 'TX'
                                ? 'bg-amber-700 hover:bg-amber-800 text-white'
                                : testCase.status === 'RX'
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : ''
                            }
                          >
                            {testCase.status}
                            {testCase.statusSpinner && testCase.status !== 'completed' && testCase.status !== 'failed' && (
                              <Loader2 className="ml-2 h-3 w-3 animate-spin inline" />
                            )}
                          </Badge>
                          {testCase.evaluation?.score !== undefined && (
                            <div className="w-full">
                              <Progress value={testCase.evaluation.score * 100} className="h-2" />
                              <div className="text-xs text-muted-foreground mt-1">
                                Score: {Math.round(testCase.evaluation.score * 100)}%
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] break-words">
                      {testCase.actualResult ? (
                        <ChatMessageMarkdown>{testCase.actualResult}</ChatMessageMarkdown>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] break-words">
                      {testCase.evaluation?.explanation ? (
                        <ChatMessageMarkdown>{testCase.evaluation.explanation}</ChatMessageMarkdown>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={e => {
                          e.stopPropagation();
                          runSingleEval(testCase);
                        }}
                        disabled={runningCaseId === testCase.id || testCase.status === 'running'}
                        aria-label="Run this test case"
                      >
                        {runningCaseId === testCase.id || testCase.status === 'running' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTestCase(testCase.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedCases[testCase.id] && (
                    <TableRow>
                      <TableCell colSpan={8} className="p-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">{t('Messages')}</h3>
                            <div className="flex gap-2">
                              {testCase.conversationFlow && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (testCase.conversationFlow) {
                                      setSelectedConversation(testCase.conversationFlow);
                                    }
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  {t('View Conversation')}
                                </Button>
                              )}
                              {testCase.status === 'failed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => adjustCaseToResult(testCase)}
                                  disabled={adjustingCaseId === testCase.id}
                                >
                                  {adjustingCaseId === testCase.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      {t('Adjusting...')}
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      {t('Adjust Case to Result')}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          {testCase.messages.map((message, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                  <Select
                                    value={message.role}
                                    onValueChange={(value: 'user' | 'assistant') => 
                                      updateMessageRole(testCase.id, index, value)
                                    }
                                    disabled={testCase.status === 'running'}
                                  >
                                    <SelectTrigger className="w-[120px]">
                                      <SelectValue placeholder={t('Select role')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="user">{t('User')}</SelectItem>
                                      <SelectItem value="assistant">{t('Assistant')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeMessage(testCase.id, index);
                                  }}
                                  disabled={testCase.status === 'running'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <Textarea
                                value={message.content}
                                onChange={(e) => updateMessage(testCase.id, index, e.target.value)}
                                placeholder={`${message.role} ${t('message...')}`}
                                disabled={testCase.status === 'running'}
                              />
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              addMessage(testCase.id);
                            }}
                            disabled={testCase.status === 'running'}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('Add Message')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Conversation Flow</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-4">
            <div className="space-y-4">
              {selectedConversation?.messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    message.role === 'user' ? 'bg-muted' : 'bg-background'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold mb-2">
                        {message.role === 'user' ? 'User' : 'Assistant'}
                      </div>
                      <ChatMessageMarkdown>{message.content}</ChatMessageMarkdown>
                    </div>
                  </div>
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-muted">
                      <div className="text-sm text-muted-foreground mb-1">{t('Tool Calls')}:</div>
                      {message.toolCalls.map((toolCall, toolIndex) => (
                        <div key={toolIndex} className="text-sm">
                          <span className="font-mono">{toolCall.toolName}</span>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(toolCall.args, null, 2)}
                          </pre>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(toolCall.result, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

<div className='mt-6'>
      <Button onClick={handleSubmit(onSubmit)}
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        {t('Save')}
      </Button>      
      
</div>
    </div>
  );
} 