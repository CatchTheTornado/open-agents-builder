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
import { Plus, Play, Loader2, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';

interface Evaluation {
  isCompliant: boolean;
  explanation: string;
  score: number;
}

export default function EvalsPage() {
  const { t } = useTranslation();
  const [testCases, setTestCases] = useState<(TestCase & { evaluation?: Evaluation })[]>([]);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
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

  const toggleExpand = (id: string) => {
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
                <TableHead>{t('Expected Result')}</TableHead>
                <TableHead>{t('Actual Result')}</TableHead>
                <TableHead>{t('Evaluation')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCase) => (
                <React.Fragment key={testCase.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(testCase.id)}
                  >
                    <TableCell>{testCase.id}</TableCell>
                    <TableCell>{testCase.status || t('pending')}</TableCell>
                    <TableCell>
                      <Textarea
                        value={testCase.expectedResult}
                        onChange={(e) => updateExpectedResult(testCase.id, e.target.value)}
                        placeholder={t('Expected result...')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>{testCase.actualResult}</TableCell>
                    <TableCell>
                      {testCase.evaluation && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Progress value={testCase.evaluation.score * 100} />
                            <span className="text-sm font-medium">
                              {Math.round(testCase.evaluation.score * 100)}%
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {testCase.evaluation.explanation}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedCases.has(testCase.id) && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="space-y-4 p-4">
                          {testCase.messages.map((message, index) => (
                            <div key={index} className="space-y-2">
                              <div className="font-semibold">{message.role}</div>
                              <Textarea
                                value={message.content}
                                onChange={(e) => updateMessage(testCase.id, index, e.target.value)}
                                placeholder={`${message.role} ${t('message...')}`}
                              />
                              {message.toolCalls && (
                                <div className="pl-4">
                                  <div className="font-semibold">{t('Tool Calls:')}</div>
                                  {message.toolCalls.map((tool, toolIndex) => (
                                    <div key={toolIndex} className="pl-4">
                                      <div>{t('Name:')} {tool.name}</div>
                                      <div>{t('Arguments:')} {JSON.stringify(tool.arguments)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              addMessage(testCase.id);
                            }}
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