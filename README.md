# AtivaEdu — versão Gemini gratuita

Esta versão não usa mais a API da OpenAI.

## Configuração na Vercel

1. Crie gratuitamente uma chave da Gemini API no Google AI Studio.
2. Na Vercel, abra **Settings > Environment Variables**.
3. Adicione `GEMINI_API_KEY` com a sua chave.
4. Faça um novo deploy.
5. A variável antiga `OPENAI_API_KEY` pode ser removida.

### Opcional
`GEMINI_TEXT_MODEL` — padrão: `gemini-3.5-flash-lite`.

## Custos
O projeto usa a cota gratuita da Gemini API. Ela possui limites de uso. Ao atingir o limite, o sistema mostrará uma mensagem para aguardar e tentar novamente. Nenhuma API paga de imagem é chamada nesta versão.

## Ilustrações
Para garantir custo zero, a geração de imagem por IA foi desativada. Se o professor marcar “ilustrada”, a atividade textual ainda será criada normalmente e o sistema informará que a imagem não foi gerada no modo gratuito.
