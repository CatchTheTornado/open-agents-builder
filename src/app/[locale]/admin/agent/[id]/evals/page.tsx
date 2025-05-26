'use client';

import React, { useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgentContext } from '@/contexts/agent-context';
import { DatabaseContext } from '@/contexts/db-context';
import { useKeyContext } from '@/contexts/key-context';
import { AgentApiClient, TestCase } from '@/data/client/agent-api-client';
import { useState } from 'react';
import { Plus, Play, Loader2, Wand2, Trash2, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import { ChatMessageMarkdown } from '@/components/chat-message-markdown';
import { nanoid } from 'nanoid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Evaluation {
  isCompliant: boolean;
  explanation: string;
  score: number;
}

export default function EvalsPage() {
  const { t } = useTranslation();
  const [testCases, setTestCases] = useState<(TestCase & { evaluation?: Evaluation })[]>([]);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isRunningEvals, setIsRunningEvals] = useState(false);
  const agentContext = useAgentContext();
  const dbContext = useContext(DatabaseContext);
  const keyContext = useKeyContext();

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
      setIsRunningEvals(true);
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
      setIsRunningEvals(false);
    }
  };

  const removeTestCase = (testCaseId: string) => {
    setTestCases(prev => prev.filter(tc => tc.id !== testCaseId));
    setExpandedCases(prev => {
      const newSet = new Set(prev);
      newSet.delete(testCaseId);
      return newSet;
    });
    if (selectedCase === testCaseId) {
      setSelectedCase(null);
    }
  };

  const toggleExpand = (id: string) => {
    setSelectedCase(id);
    setExpandedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
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

  const updateExpectedResult = (testCaseId: string, result: string) => {
    setTestCases(prev => {
      const newCases = [...prev];
      const index = newCases.findIndex(tc => tc.id === testCaseId);
      newCases[index].expectedResult = result;
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

  const adjustCaseToResult = async (testCase: TestCase) => {
    if (!agentContext.current?.id || !testCase.actualResult) return;

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
    }
  };

  const addTestCase = () => {
    const newTestCase: TestCase = {
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
      const newSet = new Set(prev);
      newSet.add(newTestCase.id);
      return newSet;
    });
  };

  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case 'running':
        return (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('Running')}</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center space-x-2 text-green-600">
            <span>{t('Completed')}</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-2 text-red-600">
            <span>{t('Failed')}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 text-muted-foreground">
            <span>{t('Pending')}</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-4">
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
        <Button size="sm" variant="outline" onClick={runEvals} disabled={testCases.length === 0 || isRunningEvals}>
          {isRunningEvals ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('Running...')}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {t('Run Evals')}
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Test Cases')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ID')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('First Message')}</TableHead>
                <TableHead>{t('Expected Result')}</TableHead>
                <TableHead>{t('Actual Result')}</TableHead>
                <TableHead>{t('Evaluation')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCase) => (
                <React.Fragment key={testCase.id}>
                  <TableRow 
                    className={`cursor-pointer hover:bg-muted/50 ${selectedCase === testCase.id ? 'bg-muted' : ''} ${
                      testCase.status === 'running' ? 'bg-muted/80' : ''
                    }`}
                    onClick={() => toggleExpand(testCase.id)}
                  >
                    <TableCell>{testCase.id}</TableCell>
                    <TableCell>{getStatusDisplay(testCase.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {testCase.messages[0]?.content || ''}
                    </TableCell>
                    <TableCell>
                      <Textarea
                        value={testCase.expectedResult}
                        onChange={(e) => updateExpectedResult(testCase.id, e.target.value)}
                        placeholder={t('Expected result...')}
                        onClick={(e) => e.stopPropagation()}
                        disabled={testCase.status === 'running'}
                      />
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      {testCase.actualResult && (
                        <ChatMessageMarkdown>
                          {testCase.actualResult}
                        </ChatMessageMarkdown>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      {testCase.evaluation && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Progress value={testCase.evaluation.score * 100} />
                            <span className="text-sm font-medium">
                              {Math.round(testCase.evaluation.score * 100)}%
                            </span>
                          </div>
                          <ChatMessageMarkdown>
                            {testCase.evaluation.explanation}
                          </ChatMessageMarkdown>
                          {testCase.actualResult && testCase.status !== 'running' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustCaseToResult(testCase);
                              }}
                              className="mt-2"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {t('Adjust case to this result')}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTestCase(testCase.id);
                        }}
                        disabled={testCase.status === 'running'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedCases.has(testCase.id) && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="space-y-4 p-4">
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
        </CardContent>
      </Card>
    </div>
  );
} 