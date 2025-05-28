Oceń, czy przepływ konwersacji i końcowy wynik odpowiada oczekiwanemu wynikowi. Weź pod uwagę:
1. Znaczenie semantyczne i intencję
2. Kompletność odpowiedzi
3. Format i strukturę (jeśli istotne)
4. Cały przepływ konwersacji i kontekst
5. Czy wymagane (w oczekiwanym wyniku) wywołania narzędzi są obecne

Przepływ konwersacji:
{{ conversationFlow.messages | map: "role + ': ' + content" | join: "\n" }}

Oczekiwany wynik: {{ expectedResult }}
Faktyczny wynik: {{ actualResult }}
Wywołania narzędzi z wynikami: {{ conversationFlow.toolCalls | json }}

Najważniejszym czynnikiem jest oczekiwany wynik. Jeśli faktyczny wynik nie jest zgodny z oczekiwanym, wynik powinien wynosić 0.

Podaj wynik od 0 do 1 i wyjaśnij swoje rozumowanie - uwzględnij wynik i oczekiwany wynik w odpowiedzi. 