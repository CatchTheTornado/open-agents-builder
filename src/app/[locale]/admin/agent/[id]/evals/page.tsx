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
import { ChevronDown, ChevronUp, Plus, Play } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';

interface Evaluation {
  isCompliant: boolean;
  explanation: string;
  score: number;
}

export default function EvalsPage() {
  const [testCases, setTestCases] = useState<(TestCase & { evaluation?: Evaluation })[]>([]);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const agentContext = useAgentContext();
  const dbContext = useContext(DatabaseContext);
  const keyContext = useKeyContext();

  const generateTestCases = async () => {
    if (!agentContext.current?.prompt || !agentContext.current?.id) return;

    try {
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
    }
  };

  const runEvals = async () => {
    if (!agentContext.current?.id) return;

    let keyData: string | undefined;
    try {
      keyData = await keyContext.addApiKey();
      const client = new AgentApiClient(
        process.env.NEXT_PUBLIC_API_URL || '',
        dbContext,
        null
      );

      const result = await client.runEvals(agentContext.current.id, testCases, keyData);
      setTestCases(result.testCases);
    } catch (error) {
      console.error('Failed to run evaluations:', error);
    } finally {
      if (keyData) {
        keyContext.removeKeyByName(keyData);
      }
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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Agent Evaluations</h1>
        <div className="space-x-4">
          <Button onClick={generateTestCases}>Generate Test Cases</Button>
          <Button onClick={runEvals} disabled={testCases.length === 0}>
            <Play className="mr-2 h-4 w-4" />
            Run Evals
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected Result</TableHead>
                <TableHead>Actual Result</TableHead>
                <TableHead>Evaluation</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.map((testCase) => (
                <React.Fragment key={testCase.id}>
                  <TableRow>
                    <TableCell>{testCase.id}</TableCell>
                    <TableCell>{testCase.status || 'pending'}</TableCell>
                    <TableCell>
                      <Textarea
                        value={testCase.expectedResult}
                        onChange={(e) => updateExpectedResult(testCase.id, e.target.value)}
                        placeholder="Expected result..."
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(testCase.id)}
                      >
                        {expandedCases.has(testCase.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedCases.has(testCase.id) && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="space-y-4 p-4">
                          {testCase.messages.map((message, index) => (
                            <div key={index} className="space-y-2">
                              <div className="font-semibold">{message.role}</div>
                              <Textarea
                                value={message.content}
                                onChange={(e) => updateMessage(testCase.id, index, e.target.value)}
                                placeholder={`${message.role} message...`}
                              />
                              {message.toolCalls && (
                                <div className="pl-4">
                                  <div className="font-semibold">Tool Calls:</div>
                                  {message.toolCalls.map((tool, toolIndex) => (
                                    <div key={toolIndex} className="pl-4">
                                      <div>Name: {tool.name}</div>
                                      <div>Arguments: {JSON.stringify(tool.arguments)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addMessage(testCase.id)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Message
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