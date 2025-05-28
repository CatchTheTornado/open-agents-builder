Evaluate if the conversation flow and final result matches the expected result. Consider:
1. Semantic meaning and intent
2. Completeness of the response
3. Format and structure (if relevant)
4. The entire conversation flow and context
5. If the required (in expected result) tool calls are present

Conversation Flow:
{{ conversationFlowText }}

Expected Result: {{ expectedResult }}
Actual Result: {{ actualResult }}
Tool calls with results: {{ toolCallsText }}

The most important factor is expected result. If the actual result is not as expected, the score should be 0.

Provide a score from 0 to 1 and explain your reasoning - include the score and expected result in the response. 