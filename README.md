# AulaFácil — Vercel V1

MVP responsivo para criação de atividades escolares, com atividade do aluno e gabarito exclusivo do professor em PDFs separados.

## Publicar no Vercel

1. Entre no Vercel e crie um novo projeto.
2. Importe esta pasta pelo GitHub ou envie os arquivos para um repositório.
3. Em **Settings → Environment Variables**, crie:
   - `OPENAI_API_KEY`: sua chave da OpenAI.
   - `OPENAI_MODEL`: opcional. O padrão é `gpt-5-mini`.
4. Faça o deploy novamente depois de salvar as variáveis.

## Estrutura

- `index.html`: interface principal.
- `styles.css`: visual responsivo.
- `app.js`: formulário, prévias, histórico e PDFs.
- `api/generate-activity.js`: função protegida do Vercel que chama a IA.

## Modo demonstração

Caso a API esteja sem chave ou indisponível, o navegador gera uma atividade demonstrativa. Isso permite testar o visual e os PDFs antes de configurar a IA.
