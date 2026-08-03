const OBJECTIVE_FORBIDDEN = /\b(explique|justifique|comente|descreva|discorra|fale sobre)\b/i;

function normalize(value = '') {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}


function cleanOptionText(value = '') {
  return String(value)
    .trim()
    .replace(/^\s*\(?[A-D]\)?\s*[\)\.\-:]\s*/i, '')
    .replace(/^\s*\([A-D]\)\s*/i, '')
    .trim();
}


const ALLOWED_ILLUSTRATION_KINDS = new Set([
  'apple','flower','sun','cloud','fish','butterfly','tree','house',
  'book','pencil','planet','heart','triangle','square','circle','ball','star'
]);

function wantsIllustrations(request = {}) {
  const value = normalize(request.illustrations || '');
  return value && !['none','nao','não','sem','no'].includes(value);
}

function chooseIllustrationKind(text = '', subject = '', topic = '', index = 0) {
  const source = normalize(`${text} ${subject} ${topic}`);

  const rules = [
    ['apple', ['maca','fruta','alimentacao','alimento']],
    ['flower', ['flor','planta','jardim','primavera']],
    ['sun', ['sol','dia','calor','verao','clima']],
    ['cloud', ['nuvem','chuva','tempo','agua']],
    ['fish', ['peixe','mar','oceano','rio','animal aquatico']],
    ['butterfly', ['borboleta','inseto','metamorfose']],
    ['tree', ['arvore','natureza','meio ambiente','floresta']],
    ['house', ['casa','familia','moradia','bairro']],
    ['book', ['livro','leitura','portugues','historia','texto','pronome']],
    ['pencil', ['lapis','escrita','escrever','atividade','escola']],
    ['planet', ['planeta','sistema solar','espaco','geografia','universo']],
    ['heart', ['amor','amizade','respeito','sentimento']],
    ['triangle', ['triangulo','geometria']],
    ['square', ['quadrado','geometria']],
    ['circle', ['circulo','geometria','roda']],
    ['ball', ['bola','esporte','educacao fisica','futebol']]
  ];

  for (const [kind, words] of rules) {
    if (words.some(word => source.includes(normalize(word)))) return kind;
  }

  const defaults = ['book','pencil','star','circle'];
  return defaults[index % defaults.length];
}

function applyIllustrations(activity, request) {
  if (!activity || !Array.isArray(activity.questions)) return activity;

  const enabled = wantsIllustrations(request);
  activity.questions.forEach((q, index) => {
    if (!enabled) {
      q.illustration = null;
      return;
    }

    let kind = '';
    const visual = q.visualSupport;

    if (visual && typeof visual === 'object') {
      kind = normalize(visual.kind || visual.type || '');
    } else if (typeof visual === 'string') {
      const firstWord = normalize(visual).split(/\s+/)[0];
      if (ALLOWED_ILLUSTRATION_KINDS.has(firstWord)) kind = firstWord;
    }

    if (!ALLOWED_ILLUSTRATION_KINDS.has(kind)) {
      kind = chooseIllustrationKind(
        typeof visual === 'string' ? visual : q.prompt,
        request.subject,
        request.topic,
        index
      );
    }

    q.illustration = {
      kind,
      count: 1,
      label: '',
      caption: ''
    };
  });

  return activity;
}

function normalizeQuestionType(value = '') {
  const v = normalize(value);
  if (v.includes('objet')) return 'objetiva';
  if (v.includes('disc')) return 'discursiva';
  return 'mista';
}

function objective(prompt, options, correctOption, visualSupport = '') {
  return { type: 'objective', prompt, options, correctOption, expectedAnswer: '', visualSupport };
}

function discursive(prompt, expectedAnswer, visualSupport = '') {
  return { type: 'discursive', prompt, options: [], correctOption: '', expectedAnswer, visualSupport };
}

const pronounObjectives = [
  objective('Qual palavra é um pronome pessoal?', ['casa', 'ele', 'bonita', 'correr'], 'B'),
  objective('Na frase “Maria chegou cedo. Ela trouxe os livros.”, qual palavra substitui Maria?', ['cedo', 'livros', 'ela', 'trouxe'], 'C'),
  objective('Complete corretamente: “_____ estudamos juntos todos os dias.”', ['Nós', 'Nosso', 'Minha', 'Aquele'], 'A'),
  objective('Qual alternativa contém um pronome possessivo?', ['meu', 'ontem', 'menino', 'estudar'], 'A'),
  objective('Em “Este caderno é novo”, a palavra “Este” é um pronome:', ['pessoal', 'demonstrativo', 'indefinido', 'interrogativo'], 'B'),
  objective('Complete: “A professora chamou Pedro e _____.”', ['eu', 'mim', 'meu', 'nós'], 'B'),
  objective('Qual pronome indica uma pessoa de modo indefinido?', ['alguém', 'eu', 'este', 'meu'], 'A'),
  objective('Na frase “O livro que comprei é interessante”, “que” funciona como pronome:', ['possessivo', 'relativo', 'pessoal', 'demonstrativo'], 'B'),
  objective('Qual frase usa corretamente um pronome pessoal?', ['Mim fui à escola.', 'Eu fui à escola.', 'Meu fui à escola.', 'Este fui à escola.'], 'B'),
  objective('Complete: “João e Ana trouxeram _____ materiais.”', ['seus', 'ele', 'este', 'ninguém'], 'A'),
  objective('Qual alternativa apresenta apenas pronomes pessoais?', ['eu, tu, ele', 'meu, seu, nosso', 'este, esse, aquele', 'alguém, ninguém, tudo'], 'A'),
  objective('Em “Aquela mochila é da professora”, “Aquela” indica:', ['posse', 'uma pessoa', 'localização/distância', 'uma ação'], 'C'),
  objective('Complete corretamente: “_____ é a sua professora?”', ['Quem', 'Meu', 'Ela', 'Nosso'], 'A'),
  objective('Qual pronome pode substituir “os alunos” sem mudar o sentido?', ['eles', 'ela', 'nós', 'eu'], 'A'),
  objective('Na frase “Nossa turma venceu”, “Nossa” indica:', ['tempo', 'posse', 'ação', 'lugar'], 'B')
];

const pronounDiscursives = [
  discursive('O que são pronomes?', 'Pronomes são palavras que substituem ou acompanham os substantivos, ajudando a evitar repetições e a indicar pessoas, posse, localização ou outras relações.'),
  discursive('Reescreva “Maria chegou. Maria abriu o caderno.” evitando a repetição do nome Maria.', 'Maria chegou. Ela abriu o caderno.'),
  discursive('Cite três pronomes pessoais.', 'Resposta possível: eu, tu e ele. Também são válidos: ela, nós, vós, eles e elas.'),
  discursive('Explique o que indica um pronome possessivo e dê um exemplo.', 'O pronome possessivo indica posse ou pertencimento. Exemplo: meu caderno, sua mochila ou nossa escola.'),
  discursive('Crie uma frase usando um pronome demonstrativo.', 'Resposta possível: Este livro é muito interessante. Também são aceitas frases corretas com esse, essa, aquele, aquela e formas semelhantes.'),
  discursive('Substitua “Pedro e Lucas” por um pronome na frase “Pedro e Lucas estudam juntos”.', 'Eles estudam juntos.'),
  discursive('Identifique o pronome na frase “Ela trouxe seu estojo”.', 'Os pronomes são “Ela” (pronome pessoal) e “seu” (pronome possessivo).'),
  discursive('Explique por que usamos pronomes em um texto.', 'Usamos pronomes para substituir ou acompanhar nomes, evitar repetições e tornar o texto mais claro e organizado.'),
  discursive('Escreva uma frase com um pronome indefinido.', 'Resposta possível: Alguém deixou um livro na mesa. São aceitas outras frases corretas com alguém, ninguém, tudo, nada, muitos etc.'),
  discursive('Qual pronome pode substituir “Ana” na frase “Ana fez a tarefa”? Reescreva a frase.', 'O pronome é “ela”. Frase: Ela fez a tarefa.')
];

function mathBank(topic) {
  const t = normalize(topic);
  const bank = [];
  const op = t.includes('multip') ? 'multiplicacao' : t.includes('subtr') ? 'subtracao' : 'adicao';
  for (let i = 1; i <= 30; i++) {
    let a = 8 + i, b = 2 + (i % 8), answer, symbol;
    if (op === 'multiplicacao') { answer = a * b; symbol = '×'; }
    else if (op === 'subtracao') { a += 20; answer = a - b; symbol = '−'; }
    else { answer = a + b; symbol = '+'; }
    const wrong = [answer + 1, Math.max(0, answer - 1), answer + b];
    const options = [String(answer), ...wrong.map(String)];
    const shift = i % 4;
    const rotated = options.slice(shift).concat(options.slice(0, shift));
    const correctOption = 'ABCD'[rotated.indexOf(String(answer))];
    bank.push(objective(`Calcule: ${a} ${symbol} ${b} =`, rotated, correctOption));
  }
  return bank;
}

function createLocalActivity(request) {
  const subject = normalize(request.subject);
  const topic = normalize(request.topic);
  const quantity = Number(request.quantity) || 10;
  const type = normalizeQuestionType(request.questionType);
  let obj = [], disc = [];

  if ((subject.includes('portugues') || subject.includes('lingua')) && topic.includes('pronome')) {
    obj = pronounObjectives;
    disc = pronounDiscursives;
  } else if (subject.includes('matemat') && /(adicao|soma|subtracao|multiplicacao)/.test(topic)) {
    obj = mathBank(topic);
    disc = obj.slice(0, 10).map((q, i) => discursive(
      `Resolva e registre como pensou: ${q.prompt.replace('Calcule: ', '')}`,
      `Resultado correto: ${q.options['ABCD'.indexOf(q.correctOption)]}. O aluno pode apresentar cálculo, decomposição ou outra estratégia correta.`
    ));
  } else {
    return null;
  }

  let questions;
  if (type === 'objetiva') questions = Array.from({ length: quantity }, (_, i) => ({ ...obj[i % obj.length] }));
  else if (type === 'discursiva') questions = Array.from({ length: quantity }, (_, i) => ({ ...disc[i % disc.length] }));
  else {
    const objCount = Math.ceil(quantity / 2);
    questions = [
      ...Array.from({ length: objCount }, (_, i) => ({ ...obj[i % obj.length] })),
      ...Array.from({ length: quantity - objCount }, (_, i) => ({ ...disc[i % disc.length] }))
    ];
  }

  return {
    title: `Atividade de ${request.subject} — ${request.topic}`,
    instructions: type === 'discursiva' ? 'Leia com atenção e responda com clareza.' : type === 'objetiva' ? 'Leia cada questão e marque apenas uma alternativa.' : 'Leia com atenção e responda conforme o tipo de cada questão.',
    questions,
    source: 'local'
  };
}

function createUniversalFallback(request) {
  const quantity = Number(request.quantity) || 10;
  const type = normalizeQuestionType(request.questionType);
  const subject = String(request.subject || 'Conteúdo').trim();
  const topic = String(request.topic || 'Tema').trim();
  const grade = String(request.grade || 'Ano escolar').trim();

  const baseObjective = [
    objective(`Qual é o tema principal desta atividade?`, [subject, topic, grade, 'Nenhuma das alternativas'], 'B'),
    objective(`A qual disciplina esta atividade pertence?`, [topic, grade, subject, 'Educação Física'], 'C'),
    objective(`Para qual ano escolar a atividade foi preparada?`, [grade, subject, topic, 'Não informado'], 'A'),
    objective(`Qual alternativa repete corretamente o tema informado?`, [`${topic}`, `${subject}`, `${grade}`, 'Outro conteúdo'], 'A'),
    objective(`Qual informação indica o conteúdo que será estudado?`, ['O nome do aluno', 'A data', `O tema “${topic}”`, 'A assinatura'], 'C'),
    objective(`Em qual campo aparece “${subject}”?`, ['Disciplina', 'Ano escolar', 'Tema', 'Data'], 'A'),
    objective(`Em qual campo aparece “${grade}”?`, ['Tema', 'Ano escolar', 'Professor', 'Aluno'], 'B'),
    objective(`Qual opção reúne corretamente disciplina e tema?`, [`${subject} — ${topic}`, `${grade} — ${subject}`, `${topic} — ${grade}`, 'Aluno — Data'], 'A'),
    objective(`O objetivo da atividade é estudar principalmente:`, [grade, topic, subject, 'o nome do professor'], 'B'),
    objective(`Antes de responder, o aluno deve observar principalmente:`, ['o título e os enunciados', 'somente a data', 'somente o nome da escola', 'apenas o rodapé'], 'A')
  ];

  const baseDiscursive = [
    discursive(`Escreva qual é o tema principal desta atividade.`, topic),
    discursive(`Informe a disciplina desta atividade.`, subject),
    discursive(`Informe o ano escolar para o qual a atividade foi preparada.`, grade),
    discursive(`Copie corretamente o título do tema estudado.`, topic),
    discursive(`Complete: Esta atividade pertence à disciplina de ________.`, subject),
    discursive(`Complete: O conteúdo principal é ________.`, topic),
    discursive(`Complete: A atividade foi preparada para o ________.`, grade),
    discursive(`Escreva disciplina e tema no formato “Disciplina — Tema”.`, `${subject} — ${topic}`),
    discursive(`Qual informação do cabeçalho indica o conteúdo estudado?`, `O tema: ${topic}.`),
    discursive(`Qual informação do cabeçalho indica a área de conhecimento?`, `A disciplina: ${subject}.`)
  ];

  let questions;
  if (type === 'objetiva') {
    questions = Array.from({ length: quantity }, (_, i) => ({ ...baseObjective[i % baseObjective.length] }));
  } else if (type === 'discursiva') {
    questions = Array.from({ length: quantity }, (_, i) => ({ ...baseDiscursive[i % baseDiscursive.length] }));
  } else {
    const objectiveCount = Math.ceil(quantity / 2);
    questions = [
      ...Array.from({ length: objectiveCount }, (_, i) => ({ ...baseObjective[i % baseObjective.length] })),
      ...Array.from({ length: quantity - objectiveCount }, (_, i) => ({ ...baseDiscursive[i % baseDiscursive.length] }))
    ];
  }

  return {
    title: `Atividade de ${subject} — ${topic}`,
    instructions: type === 'objetiva'
      ? 'Leia cada questão e marque apenas uma alternativa.'
      : type === 'discursiva'
        ? 'Leia com atenção e responda com clareza.'
        : 'Leia com atenção e responda conforme o tipo de cada questão.',
    questions,
    source: 'local-fallback'
  };
}

function validateActivity(activity, request) {
  if (!activity || !Array.isArray(activity.questions)) throw new Error('A geração não devolveu uma lista válida de questões.');
  if (activity.questions.length !== Number(request.quantity)) throw new Error('A quantidade de questões retornada está incorreta.');
  const requestedType = normalizeQuestionType(request.questionType);

  activity.questions.forEach((q, index) => {
    q.number = index + 1;
    if (!q.prompt || !q.type) throw new Error(`Questão ${index + 1} incompleta.`);
    if (q.type === 'objective') {
      if (OBJECTIVE_FORBIDDEN.test(q.prompt)) throw new Error(`A questão ${index + 1} está discursiva, apesar de ser objetiva.`);
      if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`A questão ${index + 1} deve possuir quatro alternativas.`);
      q.options = q.options.map(cleanOptionText);
      if (new Set(q.options.map(normalize)).size !== 4) throw new Error(`A questão ${index + 1} possui alternativas repetidas.`);
      if (!['A', 'B', 'C', 'D'].includes(q.correctOption)) throw new Error(`A questão ${index + 1} não possui alternativa correta válida.`);
      const answerText = cleanOptionText(q.options['ABCD'.indexOf(q.correctOption)]);
      if (!answerText) throw new Error(`O gabarito da questão ${index + 1} está vazio.`);
      q.expectedAnswer = '';
      q.answer = `${q.correctOption}) ${answerText}`;
    } else if (q.type === 'discursive') {
      q.options = [];
      q.correctOption = '';
      if (!q.expectedAnswer || normalize(q.expectedAnswer).includes('resposta coerente')) throw new Error(`A questão ${index + 1} não possui resposta esperada específica.`);
      q.answer = q.expectedAnswer;
    } else throw new Error(`A questão ${index + 1} possui tipo inválido.`);
  });

  if (requestedType === 'objetiva' && activity.questions.some(q => q.type !== 'objective')) throw new Error('Foram retornadas questões discursivas em uma atividade objetiva.');
  if (requestedType === 'discursiva' && activity.questions.some(q => q.type !== 'discursive')) throw new Error('Foram retornadas questões objetivas em uma atividade discursiva.');
  if (requestedType === 'mista' && Number(request.quantity) > 1) {
    if (!activity.questions.some(q => q.type === 'objective') || !activity.questions.some(q => q.type === 'discursive')) throw new Error('A atividade mista deve conter questões objetivas e discursivas.');
  }

  activity.subject = request.subject;
  activity.grade = request.grade;
  activity.difficulty = request.difficulty;
  return applyIllustrations(activity, request);
}

function buildPrompt(request, correction = '') {
  const type = normalizeQuestionType(request.questionType);
  const typeRules = type === 'objetiva'
    ? 'Todas as questões devem ser objetivas, com exatamente quatro alternativas A, B, C e D, somente uma correta, e enunciados que possam ser respondidos escolhendo uma alternativa. Não use explique, justifique, comente, descreva ou discorra.'
    : type === 'discursiva'
      ? 'Todas as questões devem ser discursivas e sem alternativas. Cada expectedAnswer deve trazer a resposta correta, específica e completa, nunca uma frase genérica.'
      : 'Misture questões objetivas e discursivas. As objetivas devem ter quatro alternativas e uma correta. As discursivas devem ter resposta esperada específica.';

  return `Crie uma atividade escolar em português do Brasil.\n\nDADOS OBRIGATÓRIOS\n- Matéria: ${request.subject}\n- Ano escolar: ${request.grade}\n- Tema: ${request.topic}\n- Quantidade exata: ${request.quantity}\n- Dificuldade: ${request.difficulty}\n- Tipo: ${request.questionType}\n\nREGRAS OBRIGATÓRIAS\n- ${typeRules}\n- Respeite exatamente o ano escolar informado.\n- Não entregue respostas vagas, como “resposta coerente”, “resposta pessoal” ou “de acordo com o aluno”.\n- Toda resposta do gabarito deve ser verificável e diretamente relacionada à questão.\n- Evite questões repetidas.\n- Em objective: options tem 4 textos sem letras, números ou prefixos no início; não escreva A), B), C), D), (A), (B), (C) ou (D) dentro de options; correctOption é A, B, C ou D; expectedAnswer é vazio.\n- Em discursive: options é []; correctOption é vazio; expectedAnswer contém uma resposta-modelo específica.\n- Ilustrações solicitadas: ${request.illustrations || 'none'}.
- Quando as ilustrações estiverem ativadas, visualSupport deve conter APENAS um destes nomes: apple, flower, sun, cloud, fish, butterfly, tree, house, book, pencil, planet, heart, triangle, square, circle, ball ou star.
- Escolha o desenho com base principalmente na RESPOSTA CORRETA e na ação ou objeto central de cada questão. Exemplos: correr/pular/dançar=ball; escrever=pencil; ler=book; comer=apple; nadar=fish; voar=butterfly; casa/morar=house; amor=heart. Quando as ilustrações estiverem desativadas, visualSupport deve ser vazio.\n- Orientações extras: ${request.extraInstructions || 'nenhuma'}.\n${correction ? `CORRIJA A TENTATIVA ANTERIOR: ${correction}` : ''}`;
}

const responseSchema = {
  type: 'object', required: ['title', 'instructions', 'questions'], properties: {
    title: { type: 'string' }, instructions: { type: 'string' }, questions: {
      type: 'array', items: { type: 'object', required: ['type', 'prompt', 'options', 'correctOption', 'expectedAnswer', 'visualSupport'], properties: {
        type: { type: 'string', enum: ['objective', 'discursive'] }, prompt: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correctOption: { type: 'string' }, expectedAnswer: { type: 'string' }, visualSupport: { type: 'string' }
      }}
    }
  }
};

async function callGeminiModel(key, model, request, correction = '') {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(request, correction) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: 8192
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`${model} (${response.status}): ${raw.slice(0, 700)}`);

  let output;
  try { output = JSON.parse(raw); }
  catch { throw new Error(`${model}: resposta inválida da API.`); }

  const generated = output?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!generated) {
    const reason = output?.candidates?.[0]?.finishReason || output?.promptFeedback?.blockReason || 'sem conteúdo';
    throw new Error(`${model}: ${reason}.`);
  }

  const cleaned = generated
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try { return JSON.parse(cleaned); }
  catch { throw new Error(`${model}: o conteúdo retornado não era um JSON válido.`); }
}

async function callGemini(key, request, previousError = '') {
  const configured = String(process.env.GEMINI_MODEL || '').trim();
  const models = [...new Set([
    configured,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-latest'
  ].filter(Boolean))];

  const errors = [];
  for (const model of models) {
    try {
      return await callGeminiModel(key, model, request, previousError || errors.join(' | '));
    } catch (error) {
      errors.push(error.message);
    }
  }

  const details = errors.join(' | ');
  if (/429|quota|rate limit|resource_exhausted/i.test(details)) {
    throw new Error('A cota gratuita da chave Gemini foi atingida. Crie uma nova chave em outro projeto do Google AI Studio ou ative o faturamento. Detalhes: ' + details);
  }
  throw new Error(details);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!data?.subject || !data?.grade || !data?.topic || !data?.quantity) {
      return res.status(400).json({ error: 'Preencha todos os dados obrigatórios.' });
    }

    const key = String(process.env.GEMINI_API_KEY || '').trim();

    // Bancos locais de qualidade conhecidos continuam disponíveis.
    const local = createLocalActivity(data);

    if (!key) {
      if (local) return res.status(200).json(validateActivity(local, data));
      return res.status(500).json({
        error: 'A chave GEMINI_API_KEY não está configurada no Vercel. Sem a chave, não é possível criar uma atividade específica para esse tema.'
      });
    }

    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const generated = await callGemini(key, data, lastError);
        return res.status(200).json(validateActivity(generated, data));
      } catch (error) {
        lastError = error.message;
        console.error(`Tentativa Gemini ${attempt + 1}:`, lastError);
      }
    }

    // Nunca mais entrega perguntas genéricas sobre matéria, tema ou ano.
    if (local) return res.status(200).json(validateActivity(local, data));

    return res.status(502).json({
      error: `A inteligência artificial não conseguiu gerar a atividade agora. Verifique a GEMINI_API_KEY e os logs do Vercel. Detalhe: ${lastError.slice(0, 500)}`
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error?.message || 'Ocorreu um erro ao montar a atividade.'
    });
  }
}


// CORRECAO ILUSTRACOES CONTEXTO V7
// Use o contexto da pergunta e resposta correta para escolher a ilustração.
function chooseIllustrationByContext(question, answer){
 const t = (String(question||'')+' '+String(answer||''))
 .toLowerCase()
 .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

 if(/arvore|pomar|floresta|planta/.test(t)) return 'tree';
 if(/gibi|livro|leitura|texto|caderno|estudar/.test(t)) return 'book';
 if(/bola|futebol|jogo|esporte|quadra/.test(t)) return 'ball';
 if(/dinheiro|comprar|preco|loja|moeda/.test(t)) return 'coin';
 if(/festa|convidado|pessoas|alunos|turma/.test(t)) return 'people';
 if(/mapa|estado|brasil|cidade|geografia/.test(t)) return 'map';
 if(/animal|cachorro|gato|peixe/.test(t)) return 'animal';

 return 'book';
}
