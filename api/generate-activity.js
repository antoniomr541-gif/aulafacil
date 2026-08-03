function parseBody(body) {
  return typeof body === "string" ? JSON.parse(body) : body || {};
}

function normalizeType(value = "") {
  const type = String(value).toLowerCase();
  if (type.includes("mista")) return "mista";
  if (type.includes("discurs") || type.includes("dissert")) return "discursiva";
  return "objetiva";
}

function genericAnswer(value = "") {
  const text = String(value).trim().toLowerCase();
  return !text || [
    "resposta coerente",
    "resposta correta",
    "resposta adequada",
    "resposta pessoal",
    "alternativa correta",
    "aceitar resposta",
    "de acordo com o tema"
  ].some((item) => text.includes(item));
}

function promptFor(data) {
  const type = normalizeType(data.questionType);
  const typeRules = type === "objetiva"
    ? `Todas as questões devem ser objetivas de múltipla escolha. Cada questão deve ter exatamente 4 alternativas plausíveis. Apenas uma pode estar correta. Não use comandos como explique, descreva, justifique, comente ou fale sobre.`
    : type === "discursiva"
      ? `Todas as questões devem ser discursivas. Não inclua alternativas. Cada gabarito deve trazer uma resposta-modelo específica, factual e completa.`
      : `Alterne questões objetivas e discursivas. Nas objetivas, use exatamente 4 alternativas plausíveis e apenas uma correta. Nas discursivas, não inclua alternativas e forneça uma resposta-modelo específica.`;

  const autismRules = data.autism && data.autism !== "no"
    ? `Adapte para estudante autista no nível ${data.autism}: comandos curtos, literais e diretos; uma ação por questão; linguagem sem ambiguidade; organização visual limpa.`
    : `Atividade regular, adequada à faixa escolar.`;

  const visualRules = data.illustrations === "none"
    ? `Não inclua apoio visual.`
    : `Quando for pedagogicamente útil, escreva em visualSupport uma descrição curta e concreta de uma ilustração que possa acompanhar a questão. Não gere links.`;

  return `Crie uma atividade escolar original em português do Brasil.

Matéria: ${data.subject}
Ano escolar: ${data.grade}
Tema: ${data.topic}
Quantidade exata de questões: ${data.quantity}
Dificuldade: ${data.difficulty}
Tipo solicitado: ${type}
Estilo de impressão: ${data.printStyle}
Orientações extras: ${data.extraInstructions || "nenhuma"}

${typeRules}
${autismRules}
${visualRules}

Regras obrigatórias:
1. Respeite exatamente o ano escolar e o tema.
2. Gere exatamente ${data.quantity} questões, sem repetição.
3. Não revele a resposta no enunciado.
4. As alternativas erradas devem ser plausíveis, nunca textos como "alternativa incorreta".
5. O gabarito deve conter a resposta realmente correta.
6. Nunca escreva "resposta coerente", "resposta correta", "resposta adequada" ou outra resposta genérica.
7. Em questão objetiva, answer deve ser a letra seguida do texto exato da alternativa correta, por exemplo: "B) Salvador".
8. Em questão discursiva, answer deve ser uma resposta-modelo específica e correta.
9. Retorne somente JSON válido, sem markdown.

Formato obrigatório:
{
  "title": "Título da atividade",
  "instructions": "Orientação curta ao aluno",
  "subject": "${data.subject}",
  "grade": "${data.grade}",
  "difficulty": "${data.difficulty}",
  "questions": [
    {
      "number": 1,
      "type": "objetiva",
      "prompt": "Enunciado",
      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "correctOption": "B",
      "answer": "B) Texto exato da alternativa correta",
      "visualSupport": ""
    }
  ]
}`;
}

function validate(activity, data) {
  if (!activity || !Array.isArray(activity.questions)) {
    throw new Error("A IA retornou uma estrutura inválida.");
  }
  if (activity.questions.length !== data.quantity) {
    throw new Error("A IA retornou uma quantidade incorreta de questões.");
  }

  const requested = normalizeType(data.questionType);
  const questions = activity.questions.map((q, index) => {
    const expectedType = requested === "mista"
      ? (index % 2 === 0 ? "objetiva" : "discursiva")
      : requested;
    const prompt = String(q.prompt || "").trim();
    if (!prompt) throw new Error(`Questão ${index + 1} sem enunciado.`);

    if (expectedType === "objetiva") {
      const forbidden = /\b(explique|descreva|justifique|comente|disserte|fale sobre)\b/i;
      if (forbidden.test(prompt)) {
        throw new Error(`Questão ${index + 1} não é objetiva.`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Questão ${index + 1} não possui quatro alternativas.`);
      }
      const options = q.options.map((o) => String(o || "").trim());
      if (options.some((o) => !o || /alternativa incorreta|resposta correta/i.test(o))) {
        throw new Error(`Questão ${index + 1} possui alternativa genérica.`);
      }
      const letter = String(q.correctOption || q.answerLetter || "").trim().toUpperCase();
      if (!/[ABCD]/.test(letter)) {
        throw new Error(`Questão ${index + 1} não possui alternativa correta válida.`);
      }
      const correctText = options["ABCD".indexOf(letter)];
      return {
        number: index + 1,
        type: "objetiva",
        prompt,
        options,
        correctOption: letter,
        answer: `${letter}) ${correctText}`,
        visualSupport: String(q.visualSupport || "").trim()
      };
    }

    const answer = String(q.answer || "").trim();
    if (genericAnswer(answer)) {
      throw new Error(`Gabarito da questão ${index + 1} está genérico.`);
    }
    return {
      number: index + 1,
      type: "discursiva",
      prompt,
      options: null,
      correctOption: null,
      answer,
      visualSupport: String(q.visualSupport || "").trim()
    };
  });

  return {
    title: String(activity.title || `Atividade de ${data.subject} — ${data.topic}`).trim(),
    instructions: String(activity.instructions || "Leia com atenção e responda às questões.").trim(),
    subject: data.subject,
    grade: data.grade,
    difficulty: data.difficulty,
    questions
  };
}

async function callGemini(data, apiKey) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptFor(data) }] }],
      generationConfig: {
        temperature: 0.45,
        responseMimeType: "application/json"
      }
    })
  });

  const result = await response.json();
  if (!response.ok) {
    const message = result?.error?.message || "O Gemini não conseguiu gerar a atividade.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const text = result?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (!text) throw new Error("O Gemini retornou uma resposta vazia.");
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY não configurada no Vercel."
    });
  }

  try {
    const body = parseBody(req.body);
    const data = {
      subject: String(body.subject || "").trim(),
      grade: String(body.grade || "").trim(),
      topic: String(body.topic || "").trim(),
      quantity: Math.min(Math.max(Number.parseInt(body.quantity, 10) || 10, 1), 30),
      difficulty: String(body.difficulty || "Média").trim(),
      questionType: String(body.questionType || "Objetiva").trim(),
      printStyle: String(body.printStyle || "Preto e branco").trim(),
      illustrations: String(body.illustrations || "none").trim(),
      autism: String(body.autism || "no").trim(),
      extraInstructions: String(body.extraInstructions || "").trim()
    };

    if (!data.subject || !data.grade || !data.topic) {
      return res.status(400).json({ error: "Preencha matéria, ano escolar e tema." });
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const activity = await callGemini(data, apiKey);
        return res.status(200).json(validate(activity, data));
      } catch (error) {
        lastError = error;
        console.error(`Tentativa ${attempt}:`, error);
        if ([400, 401, 403, 429].includes(error.status)) break;
      }
    }

    const status = lastError?.status === 429 ? 429 : 500;
    return res.status(status).json({
      error: lastError?.message || "Não foi possível gerar uma atividade válida."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao gerar atividade." });
  }
}
