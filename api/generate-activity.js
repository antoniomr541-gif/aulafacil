const OPENAI_URL = 'https://api.openai.com/v1/responses';
const IMAGE_URL = 'https://api.openai.com/v1/images/generations';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function validateActivity(activity, topic, quantity) {
  if (!activity || !Array.isArray(activity.questions) || activity.questions.length !== quantity) {
    throw new Error('A IA não retornou a quantidade correta de questões.');
  }
  const topicNorm = normalizeText(topic);
  const prompts = new Set();
  activity.questions.forEach((q, i) => {
    q.prompt = clean(q.prompt, 700);
    if (!q.prompt) throw new Error(`Questão ${i + 1} sem enunciado.`);
    const promptNorm = normalizeText(q.prompt);
    if (prompts.has(promptNorm)) throw new Error('A IA repetiu questões.');
    prompts.add(promptNorm);

    if (q.type === 'objetiva') {
      if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`Questão ${i + 1} sem quatro alternativas.`);
      q.options = q.options.map(x => clean(x, 250));
      const normalized = q.options.map(normalizeText);
      if (new Set(normalized).size !== 4) throw new Error(`Questão ${i + 1} possui alternativas repetidas.`);
      if (normalized.some(x => x === topicNorm)) throw new Error(`Questão ${i + 1} usa o próprio tema como alternativa.`);
      if (!['A','B','C','D'].includes(q.correctOption)) throw new Error(`Gabarito inválido na questão ${i + 1}.`);
      const idx = 'ABCD'.indexOf(q.correctOption);
      q.answer = `${q.correctOption}) ${q.options[idx]}`;
    } else {
      q.type = 'discursiva';
      q.options = null;
      q.answer = clean(q.answer, 800);
      if (!q.answer || normalizeText(q.answer).includes('resposta pessoal')) throw new Error(`Resposta genérica na questão ${i + 1}.`);
    }
  });
  return activity;
}

function buildPrompt(data) {
  const typeRule = data.questionType === 'objetiva'
    ? 'Todas as questões devem ser objetivas, com exatamente quatro alternativas e apenas uma correta.'
    : data.questionType === 'discursiva'
      ? 'Todas as questões devem ser discursivas e ter resposta-modelo específica.'
      : 'Misture questões objetivas e discursivas de forma equilibrada.';

  return `Você é um professor brasileiro experiente e criterioso. Crie uma atividade escolar real, pedagógica e variada.

Disciplina: ${data.subject}
Ano/série: ${data.grade}
Tema: ${data.topic}
Quantidade exata: ${data.quantity}
Tipo: ${data.questionType}
Instruções do professor: ${data.instructions || 'Nenhuma'}
Adaptação TEA/TDAH: ${data.adapted ? 'Sim. Use frases curtas, linguagem literal, uma tarefa por bloco e baixa carga visual.' : 'Não.'}

${typeRule}

REGRAS OBRIGATÓRIAS:
1. Avalie conhecimento sobre o conteúdo; não pergunte apenas qual palavra se relaciona ao tema.
2. Nunca use o próprio nome do tema como alternativa ou como resposta automática.
3. Não repita enunciados nem estruturas idênticas.
4. Distratores devem ser plausíveis, mas claramente incorretos.
5. Respeite rigorosamente o nível escolar informado.
6. Não inclua o gabarito dentro do enunciado.
7. Em questões discursivas, forneça resposta-modelo concreta; nunca escreva “resposta pessoal”, “resposta coerente” ou equivalentes.
8. Para Geografia e tema vegetação, cobre biomas, funções da cobertura vegetal, preservação, clima, solo e características adequadas ao ano — não repita a palavra “vegetação” como resposta.

Responda somente com JSON válido neste formato:
{
  "title":"título curto",
  "instructions":"orientação ao aluno",
  "questions":[
    {"type":"objetiva","prompt":"...","options":["...","...","...","..."],"correctOption":"A","answer":""},
    {"type":"discursiva","prompt":"...","options":null,"correctOption":null,"answer":"resposta-modelo"}
  ]
}`;
}

async function createQuestions(apiKey, data) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
        input: buildPrompt(data) + (attempt ? '\nA tentativa anterior falhou na validação. Gere conteúdo totalmente novo e cumpra todas as regras.' : ''),
        text: { format: { type: 'json_object' } },
        temperature: 0.7
      })
    });
    const raw = await response.json();
    if (!response.ok) throw new Error(raw.error?.message || 'Falha ao gerar atividade.');
    try {
      const text = raw.output_text || raw.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text;
      const parsed = JSON.parse(text);
      return validateActivity(parsed, data.topic, data.quantity);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Não foi possível gerar uma atividade válida.');
}

async function createIllustration(apiKey, data) {
  if (!data.illustrated) return null;
  const style = data.blackWhite
    ? 'desenho educativo em preto e branco, contornos grossos e limpos, fundo branco, próprio para impressão e para colorir'
    : 'ilustração educativa colorida, limpa, amigável e com fundo claro';
  const accessibility = data.adapted
    ? 'Pouquíssimos elementos, composição previsível, sem poluição visual, sem padrões intensos.'
    : 'Composição simples e bem organizada.';
  const prompt = `Crie uma ${style} sobre o tema escolar "${data.topic}", disciplina ${data.subject}, para estudantes do ${data.grade}. ${accessibility} Não inclua letras, palavras, números, legendas, respostas, marcas ou logotipos. A imagem deve apoiar a compreensão sem entregar o gabarito.`;
  const response = await fetch(IMAGE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size: '1024x1024', quality: 'medium' })
  });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw.error?.message || 'Falha ao gerar ilustração.');
  const b64 = raw.data?.[0]?.b64_json;
  return b64 ? `data:image/png;base64,${b64}` : raw.data?.[0]?.url || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 500, { error: 'OPENAI_API_KEY não configurada na Vercel.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const data = {
      subject: clean(body.subject, 80), grade: clean(body.grade, 40), topic: clean(body.topic, 160),
      quantity: Math.max(1, Math.min(30, Number(body.quantity) || 10)),
      questionType: ['objetiva','discursiva','mista'].includes(body.questionType) ? body.questionType : 'objetiva',
      instructions: clean(body.instructions, 600), illustrated: Boolean(body.illustrated),
      adapted: Boolean(body.adapted), blackWhite: Boolean(body.blackWhite)
    };
    if (!data.subject || !data.grade || !data.topic) return json(res, 400, { error: 'Preencha disciplina, ano e tema.' });
    const activity = await createQuestions(apiKey, data);
    let illustration = null;
    let illustrationWarning = null;
    try { illustration = await createIllustration(apiKey, data); }
    catch (e) { illustrationWarning = e.message; }
    return json(res, 200, { ...activity, illustration, illustrationWarning });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Erro inesperado.' });
  }
};
