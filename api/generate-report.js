function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function clean(value, max = 1200) { return String(value ?? '').trim().slice(0, max); }

function buildPrompt(data) {
  return `Você é uma professora brasileira de Educação Infantil com excelente escrita pedagógica. Gere um relatório individual descritivo, acolhedor, profissional e alinhado à BNCC.

CRIANÇA: ${data.childName}
GRUPO: ${data.group}
PERÍODO: ${data.period}
OBSERVAÇÕES REAIS INFORMADAS PELA PROFESSORA:
${data.observations}

PONTOS QUE A PROFESSORA QUER DESTACAR:
${data.highlights || 'Nenhum ponto adicional informado.'}

ORIENTAÇÕES OBRIGATÓRIAS:
- Para G4/G5, considere a faixa "crianças pequenas" (4 anos a 5 anos e 11 meses).
- Use como referência os seis direitos de aprendizagem e desenvolvimento da BNCC: Conviver, Brincar, Participar, Explorar, Expressar e Conhecer-se.
- Considere os cinco Campos de Experiência: "O eu, o outro e o nós"; "Corpo, gestos e movimentos"; "Traços, sons, cores e formas"; "Escuta, fala, pensamento e imaginação"; "Espaços, tempos, quantidades, relações e transformações".
- NÃO invente comportamentos, dificuldades, diagnósticos, conquistas, falas ou fatos que não estejam nas observações.
- Não diagnostique TEA, TDAH, transtornos, deficiência ou qualquer condição de saúde.
- Evite rótulos como "preguiçoso", "agressivo", "problemático", "atrasado" ou comparações com outras crianças.
- Quando houver algo em desenvolvimento, escreva de modo pedagógico e respeitoso, indicando possibilidades de mediação.
- Não invente códigos EI03xx se a professora não os informou. Alinhe o texto à BNCC pelos direitos e Campos de Experiência.
- Escreva em português do Brasil, em terceira pessoa, com tom natural e humano. Evite parecer texto genérico de IA.
- Produza entre 5 e 8 parágrafos curtos.

Responda SOMENTE com JSON válido:
{
  "title":"Relatório Individual de Desenvolvimento e Aprendizagem",
  "summary":"texto completo do relatório em parágrafos separados por \\n\\n",
  "bnccHighlights":["item 1","item 2","item 3"],
  "nextSteps":["mediação pedagógica 1","mediação pedagógica 2"]
}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 500, { error: 'GEMINI_API_KEY não configurada na Vercel.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const data = {
      childName: clean(body.childName, 120),
      group: clean(body.group, 80),
      period: clean(body.period, 100),
      observations: clean(body.observations, 3500),
      highlights: clean(body.highlights, 1800)
    };
    if (!data.childName || !data.group || !data.period || !data.observations) {
      return json(res, 400, { error: 'Preencha nome da criança, grupo, período e observações.' });
    }
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(data) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.45 }
      })
    });
    const raw = await response.json();
    if (!response.ok) {
      if (response.status === 429) throw new Error('Limite gratuito do Gemini atingido. Aguarde um pouco e tente novamente.');
      throw new Error(raw.error?.message || 'Falha ao gerar relatório com Gemini.');
    }
    const text = raw.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!text) throw new Error('O Gemini não retornou o relatório.');
    const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
    if (!parsed.summary) throw new Error('O relatório retornado ficou incompleto. Tente novamente.');
    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: error.message || 'Erro inesperado.' });
  }
};
