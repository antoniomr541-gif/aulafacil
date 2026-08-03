
export default async function handler(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({ error: 'OPENAI_API_KEY não configurada' });
  }

  try {
    const data = typeof request.body === 'string'
      ? JSON.parse(request.body || '{}')
      : (request.body || {});

    const required = ['subject', 'grade', 'topic', 'quantity', 'difficulty', 'questionType'];
    const missing = required.filter((field) => !data[field]);
    if (missing.length) {
      return response.status(400).json({
        error: 'Dados incompletos',
        fields: missing
      });
    }

    const quantity = Math.min(Math.max(Number(data.quantity) || 10, 5), 30);
    const prompt = `Crie uma atividade escolar em português do Brasil.

Matéria: ${data.subject}
Ano escolar: ${data.grade}
Tema: ${data.topic}
Quantidade de questões: ${quantity}
Dificuldade: ${data.difficulty}
Tipo de questões: ${data.questionType}
Estilo de impressão: ${data.printStyle || 'Preto e branco'}
Orientação adicional: ${data.extraInstructions || 'Nenhuma'}

Regras obrigatórias:
- Use linguagem adequada ao ano escolar.
- Não mostre respostas nos enunciados.
- O gabarito será exibido separadamente e apenas ao professor.
- Para questões objetivas, forneça exatamente quatro alternativas plausíveis.
- Numere as questões de 1 até ${quantity}.
- Retorne somente JSON válido, sem Markdown.

Formato:
{"title":"...","instructions":"...","grade":"...","subject":"...","topic":"...","questions":[{"number":1,"prompt":"...","answer":"...","options":null}]}`;

    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        input: prompt,
        text: { format: { type: 'json_object' } }
      })
    });

    if (!openAIResponse.ok) {
      const details = await openAIResponse.text();
      console.error('Erro da OpenAI:', details);
      return response.status(502).json({ error: 'Falha ao gerar atividade com IA' });
    }

    const result = await openAIResponse.json();
    const outputText = result.output_text
      || result.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;

    if (!outputText) {
      throw new Error('A IA não retornou conteúdo textual');
    }

    const activity = JSON.parse(outputText);
    activity.generatedAt = new Date().toISOString();

    return response.status(200).json(activity);
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      error: 'Não foi possível gerar a atividade'
    });
  }
}
