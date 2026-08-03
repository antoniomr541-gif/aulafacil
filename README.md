# AulaFácil V6 — versão estável

Versão corrigida para Vercel, Supabase e Gemini.

## Correções principais

- Não existe nenhuma referência à `OPENAI_API_KEY`.
- O navegador mostra apenas a mensagem real devolvida pelo servidor.
- Questões objetivas são validadas antes de aparecerem.
- O gabarito das objetivas mostra a letra e o texto corretos.
- Questões discursivas exigem resposta-modelo específica.
- Respostas genéricas como “resposta coerente” são rejeitadas.
- Se o Gemini falhar ou ainda não estiver configurado, há geração local real para:
  - Português: pronomes;
  - Matemática: adição, subtração e multiplicação.

## Variáveis no Vercel

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY` — recomendada, com cota gratuita disponível conforme as regras do Google.
- `GEMINI_MODEL` — opcional; padrão `gemini-2.5-flash`.

Após substituir os arquivos no GitHub, faça um novo deploy no Vercel sem reutilizar o cache anterior.
