const OBJECTIVE_FORBIDDEN = /\b(explique|justifique|comente|descreva|discorra|fale sobre|registre|escreva|responda)\b/i;
const GENERIC_ANSWER = /resposta coerente|resposta pessoal|resposta adequada|qualquer resposta|de acordo com o aluno|de acordo com o tema|informação correta|informação verdadeira|conforme (o )?conteúdo|resposta possível sem exemplo/i;

function normalize(value = '') {
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    throw new Error('Este tema precisa da IA Gemini para gerar questões e gabaritos específicos. Configure GEMINI_API_KEY no Vercel.');
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
      q.options = q.options.map(v => String(v).trim());
      if (new Set(q.options.map(normalize)).size !== 4) throw new Error(`A questão ${index + 1} possui alternativas repetidas.`);
      if (!['A', 'B', 'C', 'D'].includes(q.correctOption)) throw new Error(`A questão ${index + 1} não possui alternativa correta válida.`);
      const answerText = q.options['ABCD'.indexOf(q.correctOption)];
      if (!answerText) throw new Error(`O gabarito da questão ${index + 1} está vazio.`);
      q.expectedAnswer = '';
      q.answer = `${q.correctOption}) ${answerText}`;
    } else if (q.type === 'discursive') {
      q.options = [];
      q.correctOption = '';
      if (!q.expectedAnswer || GENERIC_ANSWER.test(q.expectedAnswer)) throw new Error(`A questão ${index + 1} não possui resposta esperada específica e verificável.`);
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
  return activity;
}

function buildPrompt(request, correction = '') {
  const type = normalizeQuestionType(request.questionType);
  const typeRules = type === 'objetiva'
    ? 'Todas as questões devem ser objetivas, com exatamente quatro alternativas A, B, C e D, somente uma correta, e enunciados que possam ser respondidos escolhendo uma alternativa. Não use explique, justifique, comente, descreva ou discorra.'
    : type === 'discursiva'
      ? 'Todas as questões devem ser discursivas e sem alternativas. Cada expectedAnswer deve trazer a resposta correta, específica e completa, nunca uma frase genérica.'
      : 'Misture questões objetivas e discursivas. As objetivas devem ter quatro alternativas e uma correta. As discursivas devem ter resposta esperada específica.';

  return `Crie uma atividade escolar em português do Brasil.\n\nDADOS OBRIGATÓRIOS\n- Matéria: ${request.subject}\n- Ano escolar: ${request.grade}\n- Tema: ${request.topic}\n- Quantidade exata: ${request.quantity}\n- Dificuldade: ${request.difficulty}\n- Tipo: ${request.questionType}\n\nREGRAS OBRIGATÓRIAS\n- ${typeRules}\n- Respeite exatamente o ano escolar informado.\n- Não entregue respostas vagas, como “resposta coerente”, “resposta pessoal” ou “de acordo com o aluno”.\n- Toda resposta do gabarito deve ser verificável e diretamente relacionada à questão.\n- Evite questões repetidas.\n- Em objective: options tem 4 textos; correctOption é A, B, C ou D; expectedAnswer é vazio.\n- Em discursive: options é []; correctOption é vazio; expectedAnswer contém uma resposta-modelo específica.\n- Ilustrações solicitadas: ${request.illustrations || 'none'}.\n- Se ilustrações for diferente de none, visualSupport deve conter APENAS um destes códigos: book, numbers, apple, globe, leaf, animal, shapes, people, speech, science. Escolha o código mais relacionado à questão.\n- Se ilustrações for none, visualSupport deve ser vazio.\n- A presença de ilustração NÃO muda o tipo da questão: se o tipo pedido for objetiva, continue gerando somente questões objetivas com alternativas.\n- Orientações extras: ${request.extraInstructions || 'nenhuma'}.\n${correction ? `CORRIJA A TENTATIVA ANTERIOR: ${correction}` : ''}`;
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

async function callGemini(key, request, correction = '') {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(request, correction) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.35, maxOutputTokens: 8192 }
  })});
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const output = await response.json();
  const text = output?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
  if (!text) throw new Error('O Gemini não retornou conteúdo.');
  return JSON.parse(text.replace(/^```json\s*/i, '').replace(/\s*```$/, ''));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!data?.subject || !data?.grade || !data?.topic || !data?.quantity) return res.status(400).json({ error: 'Preencha todos os dados obrigatórios.' });
    const key = process.env.GEMINI_API_KEY;
    let lastError = '';

    if (key) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return res.status(200).json(validateActivity(await callGemini(key, data, lastError), data)); }
        catch (error) { lastError = error.message; }
      }
    }

    const local = createLocalActivity(data);
    return res.status(200).json(validateActivity(local, data));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ocorreu um erro ao montar a atividade. Tente novamente.' });
  }
}
