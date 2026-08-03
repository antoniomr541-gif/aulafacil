function parseBody(body) {
  if (!body) return {};

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

function normalizeType(value = "") {
  const type = String(value).toLowerCase();

  if (type.includes("mista")) return "mista";

  if (
    type.includes("discurs") ||
    type.includes("dissert") ||
    type.includes("aberta")
  ) {
    return "discursiva";
  }

  return "objetiva";
}

function isGenericAnswer(value = "") {
  const text = String(value).trim().toLowerCase();

  const forbidden = [
    "resposta coerente",
    "resposta correta",
    "resposta adequada",
    "resposta pessoal",
    "alternativa correta",
    "aceitar resposta",
    "de acordo com o tema",
    "qualquer resposta",
    "resposta do aluno",
  ];

  return !text || forbidden.some((item) => text.includes(item));
}

function buildPrompt(data) {
  const type = normalizeType(data.questionType);

  let questionRules = "";

  if (type === "objetiva") {
    questionRules = `
Todas as questões devem ser objetivas de múltipla escolha.

Cada questão deve:
- ter exatamente quatro alternativas;
- possuir somente uma alternativa correta;
- apresentar alternativas plausíveis;
- usar um enunciado realmente objetivo;
- pedir para identificar, marcar, selecionar, assinalar ou completar.

Não use nos enunciados:
- explique;
- descreva;
- justifique;
- comente;
- disserte;
- fale sobre.
`;
  } else if (type === "discursiva") {
    questionRules = `
Todas as questões devem ser discursivas.

Não inclua alternativas.

Cada questão deve possuir uma resposta-modelo:
- específica;
- factual;
- completa;
- adequada ao ano escolar.

Nunca use respostas genéricas.
`;
  } else {
    questionRules = `
Alterne questões objetivas e discursivas, começando por uma objetiva.

Nas questões objetivas:
- use exatamente quatro alternativas;
- somente uma alternativa deve estar correta;
- não use comandos discursivos.

Nas questões discursivas:
- não inclua alternativas;
- forneça uma resposta-modelo específica e correta.
`;
  }

  const autismRules =
    data.autism && data.autism !== "no"
      ? `
Adapte a atividade para estudante autista.

Nível informado: ${data.autism}.

Use:
- comandos curtos;
- linguagem literal;
- uma ação por questão;
- organização visual limpa;
- frases diretas;
- pouca poluição visual;
- exemplos quando forem necessários.

Evite:
- ambiguidades;
- metáforas desnecessárias;
- enunciados excessivamente longos.
`
      : `
Crie uma atividade regular, adequada ao ano escolar informado.
`;

  const illustrationRules =
    data.illustrations === "none"
      ? `
Não inclua apoio visual.
O campo visualSupport deve ser uma string vazia.
`
      : `
Quando uma ilustração ajudar na compreensão, preencha visualSupport com uma descrição curta da imagem necessária.

Não gere:
- links;
- imagens em base64;
- endereços externos.
`;

  return `
Crie uma atividade escolar original em português do Brasil.

DADOS DA ATIVIDADE

Matéria: ${data.subject}
Ano escolar: ${data.grade}
Tema: ${data.topic}
Quantidade exata de questões: ${data.quantity}
Dificuldade: ${data.difficulty}
Tipo solicitado: ${type}
Estilo de impressão: ${data.printStyle}
Orientações extras: ${data.extraInstructions || "nenhuma"}

REGRAS SOBRE O TIPO DE QUESTÃO

${questionRules}

ADAPTAÇÃO

${autismRules}

ILUSTRAÇÕES

${illustrationRules}

REGRAS OBRIGATÓRIAS

1. Respeite exatamente o ano escolar informado.
2. Respeite exatamente o tema informado.
3. Gere exatamente ${data.quantity} questões.
4. Não repita questões.
5. Não revele a resposta no enunciado.
6. Não use alternativas como "resposta correta".
7. Não use alternativas como "alternativa incorreta".
8. Não use "nenhuma das anteriores".
9. As alternativas erradas devem ser plausíveis.
10. Toda questão deve possuir um gabarito verdadeiro.
11. Nunca use "resposta coerente".
12. Nunca use "resposta adequada".
13. Nunca use "resposta pessoal".
14. Nunca use qualquer gabarito genérico.
15. Em questão objetiva, correctOption deve ser A, B, C ou D.
16. Em questão objetiva, answer deve conter a letra e o texto exato da alternativa correta.
17. Em questão discursiva, answer deve conter uma resposta-modelo específica.
18. Retorne somente JSON válido.
19. Não use markdown.
20. Não coloque o JSON dentro de blocos de código.

FORMATO OBRIGATÓRIO

{
  "title": "Título da atividade",
  "instructions": "Orientação curta para o aluno",
  "subject": "${data.subject}",
  "grade": "${data.grade}",
  "difficulty": "${data.difficulty}",
  "questions": [
    {
      "number": 1,
      "type": "objetiva",
      "prompt": "Enunciado da questão",
      "options": [
        "Texto da alternativa A",
        "Texto da alternativa B",
        "Texto da alternativa C",
        "Texto da alternativa D"
      ],
      "correctOption": "B",
      "answer": "B) Texto exato da alternativa B",
      "visualSupport": ""
    },
    {
      "number": 2,
      "type": "discursiva",
      "prompt": "Enunciado da questão",
      "options": null,
      "correctOption": null,
      "answer": "Resposta-modelo específica e correta.",
      "visualSupport": ""
    }
  ]
}
`;
}

function validateActivity(activity, data) {
  if (!activity || !Array.isArray(activity.questions)) {
    throw new Error("A IA retornou uma estrutura inválida.");
  }

  if (activity.questions.length !== data.quantity) {
    throw new Error(
      `A IA deveria gerar ${data.quantity} questões, mas retornou ${activity.questions.length}.`
    );
  }

  const requestedType = normalizeType(data.questionType);

  const questions = activity.questions.map((question, index) => {
    const expectedType =
      requestedType === "mista"
        ? index % 2 === 0
          ? "objetiva"
          : "discursiva"
        : requestedType;

    const prompt = String(question.prompt || "").trim();

    if (!prompt) {
      throw new Error(`A questão ${index + 1} está sem enunciado.`);
    }

    if (expectedType === "objetiva") {
      const forbiddenCommands =
        /\b(explique|descreva|justifique|comente|disserte|fale sobre)\b/i;

      if (forbiddenCommands.test(prompt)) {
        throw new Error(
          `A questão ${index + 1} foi solicitada como objetiva, mas veio discursiva.`
        );
      }

      if (!Array.isArray(question.options)) {
        throw new Error(
          `A questão ${index + 1} não possui alternativas.`
        );
      }

      if (question.options.length !== 4) {
        throw new Error(
          `A questão ${index + 1} deve possuir exatamente quatro alternativas.`
        );
      }

      const options = question.options.map((option) =>
        String(option || "").trim()
      );

      const invalidOption = options.some(
        (option) =>
          !option ||
          /resposta correta|alternativa incorreta|nenhuma das anteriores/i.test(
            option
          )
      );

      if (invalidOption) {
        throw new Error(
          `A questão ${index + 1} possui uma alternativa genérica.`
        );
      }

      const correctOption = String(
        question.correctOption || question.answerLetter || ""
      )
        .trim()
        .toUpperCase();

      if (!/^[ABCD]$/.test(correctOption)) {
        throw new Error(
          `A questão ${index + 1} não possui uma alternativa correta válida.`
        );
      }

      const correctIndex = "ABCD".indexOf(correctOption);
      const correctText = options[correctIndex];

      if (!correctText) {
        throw new Error(
          `A resposta correta da questão ${index + 1} não foi encontrada.`
        );
      }

      return {
        number: index + 1,
        type: "objective",
        prompt,
        options,
        correctOption,
        answer: `${correctOption}) ${correctText}`,
        visualSupport: String(
          question.visualSupport || ""
        ).trim(),
      };
    }

    const answer = String(question.answer || "").trim();

    if (isGenericAnswer(answer)) {
      throw new Error(
        `O gabarito da questão ${index + 1} está genérico.`
      );
    }

    return {
      number: index + 1,
      type: "discursive",
      prompt,
      options: null,
      correctOption: null,
      answer,
      visualSupport: String(
        question.visualSupport || ""
      ).trim(),
    };
  });

  return {
    title: String(
      activity.title ||
        `Atividade de ${data.subject} — ${data.topic}`
    ).trim(),

    instructions: String(
      activity.instructions ||
        "Leia com atenção e responda às questões."
    ).trim(),

    subject: data.subject,
    grade: data.grade,
    difficulty: data.difficulty,
    questions,
  };
}

function extractText(result) {
  return (
    result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || ""
  );
}

function cleanJson(text) {
  return String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function requestGemini(data, apiKey, model) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },

    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt(data),
            },
          ],
        },
      ],

      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message ||
      `O modelo ${model} não conseguiu gerar a atividade.`;

    const error = new Error(message);
    error.status = response.status;
    error.model = model;

    throw error;
  }

  const text = cleanJson(extractText(result));

  if (!text) {
    throw new Error(
      `O modelo ${model} retornou uma resposta vazia.`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `O modelo ${model} retornou um JSON inválido.`
    );
  }
}

async function callGemini(data, apiKey) {
  const configuredModel = String(
    process.env.GEMINI_MODEL || ""
  ).trim();

  const models = [
    configuredModel,
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
  ].filter(
    (model, index, list) =>
      model && list.indexOf(model) === index
  );

  let lastError;

  for (const model of models) {
    try {
      return await requestGemini(data, apiKey, model);
    } catch (error) {
      lastError = error;

      console.error(
        `Falha ao usar o modelo ${model}:`,
        error.message
      );

      const unavailableModel =
        error.status === 404 ||
        /not found|not available|no longer available|unsupported/i.test(
          error.message || ""
        );

      if (unavailableModel) {
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ||
    new Error("Nenhum modelo do Gemini está disponível.")
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error:
        "A chave GEMINI_API_KEY não está configurada no Vercel.",
    });
  }

  try {
    const body = parseBody(req.body);

    const data = {
      subject: String(body.subject || "").trim(),

      grade: String(body.grade || "").trim(),

      topic: String(body.topic || "").trim(),

      quantity: Math.min(
        Math.max(
          Number.parseInt(body.quantity, 10) || 10,
          1
        ),
        30
      ),

      difficulty: String(
        body.difficulty || "Média"
      ).trim(),

      questionType: String(
        body.questionType || "Objetiva"
      ).trim(),

      printStyle: String(
        body.printStyle || "Preto e branco"
      ).trim(),

      illustrations: String(
        body.illustrations || "none"
      ).trim(),

      autism: String(
        body.autism || "no"
      ).trim(),

      extraInstructions: String(
        body.extraInstructions || ""
      ).trim(),
    };

    if (!data.subject || !data.grade || !data.topic) {
      return res.status(400).json({
        error:
          "Preencha matéria, ano escolar e tema.",
      });
    }

    let lastError;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const generatedActivity = await callGemini(
          data,
          apiKey
        );

        const validatedActivity = validateActivity(
          generatedActivity,
          data
        );

        return res
          .status(200)
          .json(validatedActivity);
      } catch (error) {
        lastError = error;

        console.error(
          `Tentativa ${attempt} falhou:`,
          error
        );

        if (
          [401, 403, 429].includes(error.status)
        ) {
          break;
        }
      }
    }

    let status = 500;

    if (lastError?.status === 429) {
      status = 429;
    }

    if ([401, 403].includes(lastError?.status)) {
      status = lastError.status;
    }

    return res.status(status).json({
      error:
        lastError?.message ||
        "Não foi possível gerar uma atividade válida.",
    });
  } catch (error) {
    console.error("Erro geral:", error);

    return res.status(500).json({
      error: "Erro ao gerar atividade.",
    });
  }
}
