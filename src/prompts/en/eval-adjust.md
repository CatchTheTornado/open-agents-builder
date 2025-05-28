Given the actual result of a test case, adjust the test case to make it pass. 
The test case should be modified to expect this result while maintaining its original intent.

Actual Result:
{{ actualResult }}

Please provide the adjusted test case in the following JSON format:
{
  "messages": [
    {
      "role": "user",
      "content": "user message"
    },
    {
      "role": "assistant",
      "content": "assistant response"
    }
  ],
  "expectedResult": "expected result"
}

Important requirements:
1. The messages array MUST contain at least 2 messages - one from the user and one from the assistant
2. The conversation should be natural and lead to the actual result
3. The expectedResult should match the actual result
4. The assistant's response should be meaningful and relevant to the user's message 