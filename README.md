# AtivaEdu 2.1

Correções desta versão:
- questões reais e variadas, sem repetir o tema como resposta;
- validação automática de alternativas e gabaritos;
- até 3 tentativas quando a IA retorna conteúdo inválido;
- geração real de ilustração com `gpt-image-1`;
- ilustração inserida na prévia e na impressão/PDF;
- modo preto e branco para colorir e modo adaptado com baixa poluição visual.

## Vercel
1. Suba todos os arquivos para o repositório.
2. Na Vercel, abra **Settings > Environment Variables**.
3. Crie `OPENAI_API_KEY` com sua chave.
4. Faça um novo deploy.

Opcional:
- `OPENAI_TEXT_MODEL` (padrão: `gpt-4.1-mini`)
- `OPENAI_IMAGE_MODEL` (padrão: `gpt-image-1`)
