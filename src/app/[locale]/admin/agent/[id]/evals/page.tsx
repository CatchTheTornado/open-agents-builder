'use client';

import React, { useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgentContext } from '@/contexts/agent-context';
import { DatabaseContext } from '@/contexts/db-context';
import { useKeyContext } from '@/contexts/key-context';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { useState } from 'react';
import { generateObject } from 'ai';
import { ChevronDown, ChevronUp, Plus, Play } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { llmProviderSetup } from '@/lib/llm-provider';

interface TestCase {
  id: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: {
      name: string;
      arguments: Record<string, unknown>;
    }[];
  }[];
  expectedResult: string;
  actualResult?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

interface GenerateTestCasesResponse {
  testCases: TestCase[];
}

const testCaseSchema = z.object({
  id: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    toolCalls: z.array(z.object({
      name: z.string(),
      arguments: z.record(z.unknown())
    })).optional()
  })),
  expectedResult: z.string()
});

const generateTestCasesSchema = z.object({
  testCases: z.array(testCaseSchema)
});

export default function EvalsPage() {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const agentContext = useAgentContext();
  const dbContext = useContext(DatabaseContext);
  const keyContext = useKeyContext();

  const generateTestCases = async () => {
    if (!agentContext.current?.prompt) return;

    try {
      const result = await generateObject<GenerateTestCasesResponse>({
        model: llmProviderSetup(),
        maxTokens: 2000,
        temperature: 0.2,
        topP: 0.95,
        schema: generateTestCasesSchema,
        prompt: `Based on the following agent prompt, generate a list of test cases in JSON format. Each test case should have a conversation (messages array) and expected result. The conversation can have multiple messages. Format:
        {
          "testCases": [
            {
              "id": "unique-id",
              "messages": [
                {
                  "role": "user",
                  "content": "user message"
                },
                {
                  "role": "assistant",
                  "content": "assistant message",
                  "toolCalls": [{"name": "tool_name", "arguments": {}}] // optional
                }
              ],
              "expectedResult": "expected final result"
            }
          ]
        }

        Agent prompt:
        ${agentContext.current.prompt}`,
      });

      if (result.object.testCases) {
        setTestCases(result.object.testCases);
      }
    } catch (error) {
      console.error('Failed to generate test cases:', error);
    }
  };

  const runEvals = async () => {
    if (!agentContext.current?.id) return;

    const keyData = await keyContext.addApiKey();

    const client = new OpenAgentsBuilderClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL,
      databaseIdHash: dbContext?.databaseIdHash || '',
      apiKey: keyData
    });

    try {
      for (const testCase of testCases) {
        const index = testCases.findIndex(tc => tc.id === testCase.id);
        setTestCases(prev => {
          const newCases = [...prev];
          newCases[index] = { ...testCase, status: 'running' };
          return newCases;
        });

        try {
          let messages = [...testCase.messages];
          let response: { messages: TestCase['messages']; sessionId?: string } | undefined;

          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user') {
              response = await client.chat.collectMessages(messages.slice(0, i + 1), {
                agentId: agentContext.current.id,
                sessionId: response?.sessionId
              });
              messages = response.messages;
            }
          }

          if (response) {
            setTestCases(prev => {
              const newCases = [...prev];
              newCases[index] = {
                ...testCase,
                status: 'completed',
                actualResult: response.messages[response.messages.length - 1].content
              };
              return newCases;
            });
          }
        } catch (error) {
          console.error(`Failed to run test case ${testCase.id}:`, error);
          setTestCases(prev => {
            const newCases = [...prev];
            newCases[index] = { ...testCase, status: 'failed' };
            return newCases;
          });
        }
      }
    } finally {
      keyContext.removeKeyByName(keyData);
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
                      <TableCell colSpan={5}>
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