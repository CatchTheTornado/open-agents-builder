Na podstawie poniższego promptu agenta, wygeneruj listę przypadków testowych w formacie JSON. Każdy przypadek testowy powinien zawierać konwersację (tablica messages) i oczekiwany wynik. Konwersacja może zawierać wiele wiadomości. Format:
{
  "testCases": [
    {
      "id": "unique-id",
      "messages": [
        {
          "role": "user",
          "content": "wiadomość użytkownika"
        },
        {
          "role": "assistant",
          "content": "wiadomość asystenta",
          "toolCalls": [{"name": "nazwa_narzędzia", "arguments": {}}] // opcjonalne
        }
      ],
      "expectedResult": "oczekiwany końcowy wynik"
    }
  ]
}

Prompt agenta:
{{ prompt }}

Ważne wymagania:
1. Każdy przypadek testowy powinien testować inny aspekt możliwości agenta
2. Uwzględnij przypadki testowe zarówno dla scenariuszy pomyślnych, jak i brzegowych
3. Przypadki testowe powinny obejmować wszystkie główne funkcjonalności opisane w prompcie
4. Konwersacja powinna być naturalna i realistyczna
5. Wywołania narzędzi powinny być uwzględnione tam, gdzie jest to odpowiednie
6. Oczekiwane wyniki powinny być jasne i weryfikowalne 