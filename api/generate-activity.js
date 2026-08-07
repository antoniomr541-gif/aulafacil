function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function clean(value, max = 300) { return String(value ?? '').trim().slice(0, max); }
function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const CHILD_TYPES = ['pintura','cobrir','ligar','circular','completar','recortar','coordenacao','objetiva','discursiva'];
const ICONS = ['abelha','elefante','igreja','uva','maca','bola','flor','sol','casa','arvore','peixe','gato','cachorro','borboleta','estrela','coracao','livro','lapis','banana','carro'];

function sanitizeVisual(v, fallbackType) {
  v = v && typeof v === 'object' ? v : {};
  const kind = CHILD_TYPES.includes(v.kind) ? v.kind : fallbackType;
  const icon = ICONS.includes(normalizeText(v.icon)) ? normalizeText(v.icon) : '';
  const letter = clean(v.letter, 3).toUpperCase();
  const number = clean(v.number, 4);
  const word = clean(v.word, 40).toUpperCase();
  const missingIndex = Number.isInteger(v.missingIndex) ? Math.max(0, Math.min(20, v.missingIndex)) : 0;
  let items = Array.isArray(v.items) ? v.items.map(x => clean(x, 25)).filter(Boolean).slice(0, 16) : [];
  let pairs = Array.isArray(v.pairs) ? v.pairs.slice(0, 6).map(p => ({
    left: clean(p?.left, 24), right: clean(p?.right, 24), icon: ICONS.includes(normalizeText(p?.icon)) ? normalizeText(p.icon) : ''
  })).filter(p => p.left || p.right || p.icon) : [];
  return { kind, icon, letter, number, word, missingIndex, items, pairs };
}

function validateActivity(activity, topic, quantity, data) {
  if (!activity || !Array.isArray(activity.questions) || activity.questions.length !== quantity) {
    throw new Error('A IA não retornou a quantidade correta de questões.');
  }
  const topicNorm = normalizeText(topic), prompts = new Set();
  activity.title = clean(activity.title, 120) || 'Atividade';
  activity.instructions = clean(activity.instructions, 400) || 'Faça as atividades com atenção.';

  activity.questions.forEach((q, i) => {
    q.prompt = clean(q.prompt, 700);
    if (!q.prompt) throw new Error(`Questão ${i + 1} sem enunciado.`);
    const promptNorm = normalizeText(q.prompt);
    if (prompts.has(promptNorm)) throw new Error('A IA repetiu questões.');
    prompts.add(promptNorm);

    const requested = data.questionType;
    let qType = CHILD_TYPES.includes(q.type) ? q.type : (requested === 'infantil_mista' ? 'pintura' : requested);
    if (requested !== 'infantil_mista' && requested !== 'mista') qType = requested;
    if (!CHILD_TYPES.includes(qType)) qType = 'discursiva';
    q.type = qType;

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
      q.options = null;
      q.correctOption = null;
      q.answer = clean(q.answer, 800);
      if (!q.answer) q.answer = 'Atividade prática — observar a realização da criança.';
    }
    q.visual = sanitizeVisual(q.visual, q.type);
  });
  return activity;
}

function buildPrompt(data) {
  const isEI = /Educação Infantil|G4|G5/i.test(data.grade);
  const typeInstructions = {
    objetiva: 'Todas as questões devem ser objetivas, com exatamente quatro alternativas e apenas uma correta.',
    discursiva: 'Todas as questões devem ser discursivas e ter resposta-modelo específica.',
    mista: 'Misture questões objetivas e discursivas de forma equilibrada.',
    pintura: 'Todas devem ser de PINTURA/COLORIR. O objeto a pintar precisa existir no campo visual.',
    cobrir: 'Todas devem ser de COBRIR/PONTILHADO. Use letra, número ou palavra curta no campo visual.',
    ligar: 'Todas devem ser de LIGAR. Gere pares claros no campo visual.pairs.',
    circular: 'Todas devem ser de CIRCULAR. Gere uma lista de elementos misturados em visual.items, incluindo alvos e distratores.',
    completar: 'Todas devem ser de COMPLETAR. Informe visual.word e visual.missingIndex para criar uma lacuna real.',
    recortar: 'Todas devem ser de RECORTAR E COLAR, com peças simples em visual.items.',
    coordenacao: 'Todas devem trabalhar COORDENAÇÃO MOTORA com traçados simples.',
    infantil_mista: 'Misture pintura, cobrir, ligar, circular, completar, recortar e coordenação motora. NÃO use só caixas vazias.'
  };

  return `Você é uma professora brasileira experiente. Crie uma atividade real, pronta para impressão.
Disciplina: ${data.subject}
Ano/série: ${data.grade}
Tema: ${data.topic}
Quantidade exata: ${data.quantity}
Tipo: ${data.questionType}
Nível: ${data.level}
Instruções do professor: ${data.instructions || 'Nenhuma'}
Adaptação TEA/TDAH: ${data.adapted ? 'Sim. Frases curtas, linguagem literal, uma tarefa por bloco e baixa carga visual.' : 'Não.'}
${isEI ? `EDUCAÇÃO INFANTIL: linguagem curta, concreta, lúdica, adequada a 4–5 anos; o adulto pode ler o comando; considere BNCC e Campos de Experiência.` : ''}
${typeInstructions[data.questionType] || typeInstructions.mista}

REGRAS VISUAIS OBRIGATÓRIAS:
- Quando o tipo for pintura, cobrir, ligar, circular, completar, recortar ou coordenacao, preencha o objeto "visual". O sistema desenhará o exercício a partir desses dados.
- Nunca escreva apenas "pinte a letra A" sem colocar A em visual.letter.
- Para "cobrir", use visual.letter OU visual.number OU visual.word; o sistema fará o pontilhado real.
- Para "ligar", use visual.pairs com 2 a 5 pares. Ex.: [{"left":"A","right":"ABELHA","icon":"abelha"}].
- Para "circular", use visual.items com 8 a 14 elementos curtos, misturando alvo e distratores.
- Para "completar", use visual.word e visual.missingIndex (posição da letra que deve virar lacuna).
- Para "pintura", escolha visual.icon dentre: ${ICONS.join(', ')} e, se útil, visual.letter.
- Para "recortar", use visual.items com 3 a 6 peças.
- Para "coordenacao", use visual.letter, visual.number ou visual.word para guiar o traçado.

Responda SOMENTE com JSON válido:
{
  "title":"título curto",
  "instructions":"orientação ao aluno",
  "questions":[
    {
      "type":"pintura|cobrir|ligar|circular|completar|recortar|coordenacao|objetiva|discursiva",
      "prompt":"...",
      "options":null,
      "correctOption":null,
      "answer":"orientação/gabarito",
      "visual":{"kind":"pintura","icon":"abelha","letter":"A","number":"","word":"","missingIndex":0,"items":[],"pairs":[]}
    }
  ]
}`;
}

async function createQuestions(apiKey, data) {
  let lastError;
  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(data) + (attempt ? '\nA tentativa anterior falhou na validação. Gere tudo novamente e cumpra exatamente o JSON.' : '') }] }],
        generationConfig: { responseMimeType: 'application/json' }
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
      return validateActivity(parsed, data.topic, data.quantity, data);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Não foi possível gerar uma atividade válida.');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 500, { error: 'GEMINI_API_KEY não configurada na Vercel.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const allowedTypes = ['objetiva','discursiva','mista','pintura','cobrir','ligar','circular','completar','recortar','coordenacao','infantil_mista'];
    const data = {
      subject: clean(body.subject, 80), grade: clean(body.grade, 60), topic: clean(body.topic, 160),
      quantity: Math.max(1, Math.min(30, Number(body.quantity) || 10)),
      questionType: allowedTypes.includes(body.questionType) ? body.questionType : 'objetiva',
      level: ['bem_infantil','normal','desafiadora'].includes(body.level) ? body.level : 'normal',
      instructions: clean(body.instructions, 600), illustrated: Boolean(body.illustrated),
      adapted: Boolean(body.adapted), blackWhite: Boolean(body.blackWhite)
    };
    if (!data.subject || !data.grade || !data.topic) return json(res, 400, { error: 'Preencha disciplina, ano e tema.' });
    const activity = await createQuestions(apiKey, data);
    return json(res, 200, { ...activity, illustration: null, illustrationWarning: null });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Erro inesperado.' });
  }
};
