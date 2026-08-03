const OBJECTIVE_FORBIDDEN = /\b(explique|justifique|comente|descreva|discorra|fale sobre)\b/i;

function normalizeQuestionType(value = '') {
  const v = String(value).toLowerCase();
  if (v.includes('objet')) return 'objetiva';
  if (v.includes('disc')) return 'discursiva';
  return 'mista';
}

function validateActivity(activity, request) {
  if (!activity || !Array.isArray(activity.questions)) {
    throw new Error('A IA não devolveu uma lista válida de questões.');
  }
  if (activity.questions.length !== Number(request.quantity)) {
    throw new Error('A quantidade de questões retornada está incorreta.');
  }

  const requestedType = normalizeQuestionType(request.questionType);
  activity.questions.forEach((q, index) => {
    q.number = index + 1;
    if (!q.prompt || !q.type) throw new Error(`Questão ${index + 1} incompleta.`);

    if (q.type === 'objective') {
      if (OBJECTIVE_FORBIDDEN.test(q.prompt)) {
        throw new Error(`A questão ${index + 1} está discursiva, apesar de ser objetiva.`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`A questão ${index + 1} deve possuir quatro alternativas.`);
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correctOption)) {
        throw new Error(`A questão ${index + 1} não possui alternativa correta válida.`);
      }
      q.answer = `${q.correctOption}) ${q.options['ABCD'.indexOf(q.correctOption)]}`;
    } else {
      q.options = null;
      q.correctOption = null;
      if (!q.expectedAnswer) throw new Error(`A questão ${index + 1} não possui resposta esperada.`);
      q.answer = q.expectedAnswer;
    }
  });

  if (requestedType === 'objetiva' && activity.questions.some(q => q.type !== 'objective')) {
    throw new Error('A IA retornou questão discursiva em uma atividade objetiva.');
  }
  if (requestedType === 'discursiva' && activity.questions.some(q => q.type !== 'discursive')) {
    throw new Error('A IA retornou questão objetiva em uma atividade discursiva.');
  }

  activity.subject = request.subject;
  activity.grade = request.grade;
  activity.difficulty = request.difficulty;
  return activity;
}

async function callOpenAI(key, request, correction = '') {
  const type = normalizeQuestionType(request.questionType);
  const illustration = request.illustrations === 'none'
    ? 'Não inclua apoio visual.'
    : request.illustrations === 'simple'
      ? 'Inclua apoio visual simples apenas quando for pedagogicamente útil.'
      : 'Inclua apoio visual nas questões em que ele facilitar a compreensão.';

  const autism = request.autism === 'no'
    ? 'Atividade regular.'
    : `Atividade adaptada para estudante autista, nível ${request.autism}. Use linguagem literal, comandos curtos, baixa poluição visual, uma ação por comando, boa previsibilidade e exemplos quando necessários. Não presuma que todos os estudantes autistas têm as mesmas necessidades.`;

  const typeRules = type === 'objetiva'
    ? `Todas as questões devem ser objetivas. Cada questão deve ter exatamente quatro alternativas plausíveis, A, B, C e D, e somente uma correta. Nunca use nos enunciados os verbos "explique", "justifique", "comente", "descreva", "discorra" ou "fale sobre".`
    : type === 'discursiva'
      ? 'Todas as questões devem ser discursivas, sem alternativas. Para cada uma, forneça uma resposta esperada específica e útil ao professor.'
      : 'Misture questões objetivas e discursivas de forma equilibrada. As objetivas devem ter exatamente quatro alternativas e uma única correta; as discursivas devem ter resposta esperada específica.';

  const prompt = `Crie uma atividade escolar em português do Brasil.

DADOS OBRIGATÓRIOS
- Matéria: ${request.subject}
- Ano escolar: ${request.grade}
- Tema: ${request.topic}
- Quantidade exata: ${request.quantity}
- Dificuldade: ${request.difficulty}
- Tipo solicitado: ${request.questionType}
- Impressão: ${request.printStyle}

REGRAS
${typeRules}
${illustration}
${autism}
- O conteúdo deve ser adequado especificamente ao ano escolar informado.
- Não coloque respostas no enunciado nem nas alternativas da versão do aluno.
- Evite perguntas repetidas ou genéricas.
- O gabarito deve conter respostas reais e específicas.
- Orientações extras: ${request.extraInstructions || 'nenhuma'}.
${correction ? `- CORREÇÃO OBRIGATÓRIA DA TENTATIVA ANTERIOR: ${correction}` : ''}`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'instructions', 'questions'],
    properties: {
      title: { type: 'string' },
      instructions: { type: 'string' },
      questions: {
        type: 'array',
        minItems: Number(request.quantity),
        maxItems: Number(request.quantity),
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['number', 'type', 'prompt', 'options', 'correctOption', 'expectedAnswer', 'visualSupport'],
          properties: {
            number: { type: 'integer' },
            type: { type: 'string', enum: ['objective', 'discursive'] },
            prompt: { type: 'string' },
            options: {
              anyOf: [
                { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
                { type: 'null' }
              ]
            },
            correctOption: { anyOf: [{ type: 'string', enum: ['A', 'B', 'C', 'D'] }, { type: 'null' }] },
            expectedAnswer: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            visualSupport: { type: 'string' }
          }
        }
      }
    }
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: prompt,
      text: { format: { type: 'json_schema', name: 'school_activity', strict: true, schema } }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI: ${response.status} ${detail.slice(0, 500)}`);
  }

  const output = await response.json();
  const text = output.output_text || output.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  if (!text) throw new Error('A IA não retornou conteúdo.');
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'A chave da inteligência artificial não está configurada no Vercel.' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    let firstError = '';

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const generated = await callOpenAI(key, data, firstError);
        return res.status(200).json(validateActivity(generated, data));
      } catch (error) {
        firstError = error.message;
        if (attempt === 1) throw error;
      }
    }
  } catch (error) {
    console.error('Erro ao gerar atividade:', error);
    return res.status(500).json({
      error: 'Não foi possível gerar uma atividade válida.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
