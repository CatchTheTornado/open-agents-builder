Mając dany faktyczny wynik testu, dostosuj przypadek testowy, aby przeszedł pomyślnie.
Przypadek testowy powinien zostać zmodyfikowany tak, aby oczekiwał tego wyniku, zachowując jednocześnie swoje pierwotne założenia.

Faktyczny wynik:
{{ actualResult }}

Proszę podać dostosowany przypadek testowy w następującym formacie JSON:
{
  "messages": [
    {
      "role": "user",
      "content": "wiadomość użytkownika"
    },
    {
      "role": "assistant",
      "content": "odpowiedź asystenta"
    }
  ],
  "expectedResult": "oczekiwany wynik"
}

Ważne wymagania:
1. Tablica messages MUSI zawierać co najmniej 2 wiadomości - jedną od użytkownika i jedną od asystenta
2. Konwersacja powinna być naturalna i prowadzić do faktycznego wyniku
3. Oczekiwany wynik (expectedResult) powinien odpowiadać faktycznemu wynikowi
4. Odpowiedź asystenta powinna być sensowna i istotna w kontekście wiadomości użytkownika 