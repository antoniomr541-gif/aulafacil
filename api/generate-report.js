function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function clean(value, max = 1200) { return String(value ?? '').trim().slice(0, max); }

function buildPrompt(data) {
  const infantil = /G4|G5|Educação Infantil/i.test(data.group);
  const etapa = infantil ? `
- É Educação Infantil. Considere os seis direitos de aprendizagem: Conviver, Brincar, Participar, Explorar, Expressar e Conhecer-se.
- Considere, quando pertinente às observações, os cinco Campos de Experiência: O eu, o outro e o nós; Corpo, gestos e movimentos; Traços, sons, cores e formas; Escuta, fala, pensamento e imaginação; Espaços, tempos, quantidades, relações e transformações.
- Não transforme o relatório em lista de habilidades; escreva de forma humana e descritiva.` : `
- É Ensino Fundamental (${data.group}). Relacione as observações ao desenvolvimento escolar esperado para a etapa e às competências/habilidades da BNCC de forma natural.
- Não invente códigos de habilidades, notas, conteúdos trabalhados ou desempenho que não tenham sido informados.
- Considere aprendizagem, participação, autonomia, convivência e avanços apenas quando houver evidência nas observações.`;

  return `Você é um(a) professor(a) brasileiro(a) com excelente escrita pedagógica. Gere um relatório individual descritivo, profissional, acolhedor e alinhado à BNCC.

ESTUDANTE: ${data.childName}
ETAPA/SÉRIE: ${data.group}
PERÍODO: ${data.period}
OBSERVAÇÕES REAIS INFORMADAS PELO PROFESSOR:
${data.observations}

PONTOS A DESTACAR:
${data.highlights || 'Nenhum ponto adicional informado.'}
${etapa}

REGRAS OBRIGATÓRIAS:
- NÃO invente comportamentos, dificuldades, diagnósticos, conquistas, falas, notas ou fatos não presentes nas observações.
- Não diagnostique condições de saúde ou neurodesenvolvimento.
- Evite rótulos e comparações com outros estudantes.
- Quando algo estiver em desenvolvimento, use linguagem pedagógica respeitosa e, se cabível, indique mediações possíveis.
- Escreva em português do Brasil, em terceira pessoa, com tom natural, evitando texto genérico de IA.
- Produza de 4 a 8 parágrafos curtos, conforme a quantidade de informações fornecida.

Responda SOMENTE com JSON válido:
{
  "title":"Relatório Individual de Desenvolvimento e Aprendizagem",
  "summary":"texto completo em parágrafos separados por \\n\\n",
  "bnccHighlights":["aspecto 1","aspecto 2","aspecto 3"],
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
      childName: clean(body.childName, 120), group: clean(body.group, 80), period: clean(body.period, 100),
      observations: clean(body.observations, 3500), highlights: clean(body.highlights, 1800)
    };
    if (!data.childName || !data.group || !data.period || !data.observations) return json(res, 400, { error: 'Preencha nome, etapa/série, período e observações.' });
    const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: buildPrompt(data) }] }], generationConfig: { responseMimeType: 'application/json' } })
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
  } catch (error) { return json(res, 500, { error: error.message || 'Erro inesperado.' }); }
};
