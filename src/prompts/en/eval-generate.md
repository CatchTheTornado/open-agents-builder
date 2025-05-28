Based on the following agent prompt, generate a list of test cases in JSON format. Each test case should have a conversation (messages array) and expected result. The conversation can have multiple messages. Format:
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
{{ prompt }}

Important requirements:
1. Each test case should test a different aspect of the agent's capabilities
2. Include test cases for both successful and edge cases
3. Test cases should cover all the main functionalities described in the prompt
4. The conversation should be natural and realistic
5. Tool calls should be included where appropriate
6. Expected results should be clear and verifiable 