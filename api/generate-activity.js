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

  const isEI = /Educação Infantil|G4|G5/i.test(data.grade);
  const earlyYearsRule = isEI ? `
IMPORTANTE — EDUCAÇÃO INFANTIL:
- A criança está no ${data.grade}. Use linguagem muito curta e concreta.
- Priorize propostas lúdicas, observação, associação, oralidade, desenho, contagem, movimento e exploração.
- Evite exigir leitura autônoma complexa, textos longos ou abstrações incompatíveis com 4–5 anos.
- Alinhe a proposta aos direitos da BNCC (conviver, brincar, participar, explorar, expressar e conhecer-se) e aos Campos de Experiência quando pertinente.
- O enunciado deve poder ser lido pelo professor para a criança.
` : '';

  return `Você é um professor brasileiro experiente e criterioso. Crie uma atividade escolar real, pedagógica e variada.

Disciplina: ${data.subject}
Ano/série: ${data.grade}
Tema: ${data.topic}
Quantidade exata: ${data.quantity}
Tipo: ${data.questionType}
Instruções do professor: ${data.instructions || 'Nenhuma'}
Adaptação TEA/TDAH: ${data.adapted ? 'Sim. Use frases curtas, linguagem literal, uma tarefa por bloco e baixa carga visual.' : 'Não.'}
${earlyYearsRule}
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
  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(data) + (attempt ? '\nA tentativa anterior falhou na validação. Gere conteúdo totalmente novo e cumpra todas as regras.' : '') }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      })
    });

    const raw = await response.json();
    if (!response.ok) {
      const message = raw.error?.message || 'Falha ao gerar atividade com Gemini.';
      if (response.status === 429) throw new Error('Limite gratuito do Gemini atingido. Aguarde um pouco e tente novamente.');
      throw new Error(message);
    }

    try {
      const text = raw.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      if (!text) throw new Error('O Gemini não retornou conteúdo.');
      const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      return validateActivity(parsed, data.topic, data.quantity);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Não foi possível gerar uma atividade válida.');
}

function svgDataUri(svg) {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg).replace(/%0A/g, '').replace(/%20/g, ' ');
}

// Ilustração local e gratuita: não chama nenhuma API de imagem.
function createIllustration(data) {
  if (!data.illustrated) return { illustration: null, warning: null };
  const mono = data.blackWhite;
  const stroke = mono ? '#111111' : '#4b3ab8';
  const soft = mono ? '#ffffff' : '#eeeaff';
  const accent = mono ? '#f5f5f5' : '#cfc5ff';
  const subject = normalizeText(data.subject);
  let art = '';
  if (subject.includes('matemat')) {
    art = `<circle cx="155" cy="170" r="62" fill="${soft}" stroke="${stroke}" stroke-width="7"/><text x="155" y="190" text-anchor="middle" font-size="64" font-family="Arial" fill="${stroke}">1+2</text><rect x="290" y="105" width="125" height="125" rx="18" fill="${accent}" stroke="${stroke}" stroke-width="7"/><circle cx="520" cy="168" r="64" fill="none" stroke="${stroke}" stroke-width="7"/>`;
  } else if (subject.includes('portugues') || subject.includes('lingua')) {
    art = `<path d="M110 105h180c38 0 58 19 58 48v142c-25-18-54-27-88-27H110z" fill="${soft}" stroke="${stroke}" stroke-width="7"/><path d="M590 105H410c-38 0-58 19-58 48v142c25-18 54-27 88-27h150z" fill="${soft}" stroke="${stroke}" stroke-width="7"/><text x="350" y="215" text-anchor="middle" font-size="62" font-family="Arial" font-weight="700" fill="${stroke}">A B C</text>`;
  } else if (subject.includes('ciencia')) {
    art = `<path d="M300 80v90l-95 135c-18 27 1 63 34 63h222c33 0 52-36 34-63L400 170V80" fill="${soft}" stroke="${stroke}" stroke-width="7"/><path d="M245 282h210" stroke="${stroke}" stroke-width="7"/><circle cx="310" cy="315" r="14" fill="${accent}" stroke="${stroke}" stroke-width="5"/><circle cx="390" cy="335" r="20" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`;
  } else if (subject.includes('geografia')) {
    art = `<circle cx="350" cy="215" r="135" fill="${soft}" stroke="${stroke}" stroke-width="7"/><path d="M230 160c45-40 82-40 105-8s65 8 85 28-4 52-34 58-37 38-72 42-39-38-84-28" fill="${accent}" stroke="${stroke}" stroke-width="6"/><path d="M350 80v270M215 215h270" stroke="${stroke}" stroke-width="4" opacity=".7"/>`;
  } else if (subject.includes('historia')) {
    art = `<rect x="155" y="105" width="390" height="225" rx="20" fill="${soft}" stroke="${stroke}" stroke-width="7"/><path d="M235 105v225M465 105v225" stroke="${stroke}" stroke-width="5"/><circle cx="350" cy="215" r="52" fill="${accent}" stroke="${stroke}" stroke-width="6"/><path d="M350 185v35l28 18" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/>`;
  } else {
    art = `<circle cx="240" cy="200" r="90" fill="${soft}" stroke="${stroke}" stroke-width="7"/><path d="M208 200l25 25 52-58" fill="none" stroke="${stroke}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M410 120c55 0 100 45 100 100s-45 100-100 100" fill="none" stroke="${stroke}" stroke-width="7"/><circle cx="500" cy="120" r="24" fill="${accent}" stroke="${stroke}" stroke-width="6"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="410" viewBox="0 0 700 410"><rect width="700" height="410" rx="28" fill="#fff"/><g>${art}</g><path d="M95 365h510" stroke="${stroke}" stroke-width="5" stroke-linecap="round" opacity=".25"/></svg>`;
  return { illustration: svgDataUri(svg), warning: null };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 500, { error: 'GEMINI_API_KEY não configurada na Vercel.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const data = {
      subject: clean(body.subject, 80), grade: clean(body.grade, 60), topic: clean(body.topic, 160),
      quantity: Math.max(1, Math.min(30, Number(body.quantity) || 10)),
      questionType: ['objetiva','discursiva','mista'].includes(body.questionType) ? body.questionType : 'objetiva',
      instructions: clean(body.instructions, 600), illustrated: Boolean(body.illustrated),
      adapted: Boolean(body.adapted), blackWhite: Boolean(body.blackWhite)
    };
    if (!data.subject || !data.grade || !data.topic) return json(res, 400, { error: 'Preencha disciplina, ano e tema.' });
    const activity = await createQuestions(apiKey, data);
    const imageResult = createIllustration(data);
    return json(res, 200, { ...activity, illustration: imageResult.illustration, illustrationWarning: imageResult.warning });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Erro inesperado.' });
  }
};
