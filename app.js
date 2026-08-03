const form = document.getElementById('activityForm');
const resultSection = document.getElementById('resultSection');
const generatorSection = document.getElementById('generatorSection');
const studentPreview = document.getElementById('studentPreview');
const teacherPreview = document.getElementById('teacherPreview');
const generateBtn = document.getElementById('generateBtn');
const btnLabel = generateBtn.querySelector('.btn-label');
const btnLoading = generateBtn.querySelector('.btn-loading');
const historyModal = document.getElementById('historyModal');
let currentActivity = null;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function formPayload() {
  return {
    subject: document.getElementById('subject').value,
    grade: document.getElementById('grade').value,
    topic: document.getElementById('topic').value.trim(),
    quantity: Number(document.getElementById('quantity').value),
    difficulty: document.getElementById('difficulty').value,
    questionType: document.getElementById('questionType').value,
    printStyle: document.getElementById('printStyle').value,
    extraInstructions: document.getElementById('extraInstructions').value.trim()
  };
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  btnLabel.hidden = isLoading;
  btnLoading.hidden = !isLoading;
}

async function generateActivity(payload) {
  try {
    const response = await fetch('/api/generate-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('API indisponível');
    return await response.json();
  } catch (error) {
    return createDemoActivity(payload);
  }
}

function createDemoActivity(payload) {
  const questions = [];
  const topic = payload.topic.toLowerCase();

  for (let i = 1; i <= payload.quantity; i++) {
    let prompt;
    let answer;
    let options = null;

    if (payload.subject === 'Matemática') {
      const a = 2 + i;
      const b = 3 + (i % 7);
      if (topic.includes('multiplica')) {
        prompt = `Resolva: ${a} × ${b} =`;
        answer = String(a * b);
      } else if (topic.includes('subtra')) {
        prompt = `Calcule: ${a * 10} − ${b} =`;
        answer = String(a * 10 - b);
      } else {
        prompt = `Calcule: ${a * 5} + ${b} =`;
        answer = String(a * 5 + b);
      }
    } else {
      prompt = `Questão ${i} sobre ${payload.topic}: explique com suas palavras um ponto importante do tema.`;
      answer = `Resposta esperada: explicação coerente e adequada ao ${payload.grade} sobre ${payload.topic}.`;
    }

    if (payload.questionType === 'Objetiva' || (payload.questionType === 'Mista' && i % 2 === 0)) {
      const correct = answer;
      options = [correct, `${Number(correct) + 2 || 'Alternativa B'}`, `${Number(correct) + 5 || 'Alternativa C'}`, `${Number(correct) - 1 || 'Alternativa D'}`];
      if (payload.subject !== 'Matemática') options = ['Alternativa correta', 'Alternativa incorreta', 'Outra possibilidade', 'Nenhuma das anteriores'];
    }

    questions.push({ number: i, prompt, answer, options });
  }

  return {
    title: `Atividade de ${payload.subject} — ${payload.topic}`,
    instructions: `Leia com atenção e responda às questões. Nível: ${payload.difficulty}.`,
    grade: payload.grade,
    subject: payload.subject,
    topic: payload.topic,
    questions,
    generatedAt: new Date().toISOString(),
    demo: true
  };
}

function renderActivity(activity) {
  const questionsHtml = activity.questions.map(q => {
    const options = q.options ? `<div class="options">${q.options.map((opt, idx) => `<span>(${String.fromCharCode(65 + idx)}) ${escapeHtml(opt)}</span>`).join('')}</div>` : '';
    const lines = q.options ? '' : `<div class="answer-lines"><div class="answer-line"></div><div class="answer-line"></div></div>`;
    return `<div class="question"><strong>${q.number}. ${escapeHtml(q.prompt)}</strong>${options}${lines}</div>`;
  }).join('');

  studentPreview.innerHTML = `
    <div class="paper-header">
      <h1>${escapeHtml(activity.title)}</h1>
      <p>${escapeHtml(activity.grade)} • ${escapeHtml(activity.subject)}</p>
    </div>
    <div class="student-meta">
      <div class="meta-line">Aluno(a):</div>
      <div class="meta-line">Turma:</div>
      <div class="meta-line">Data:</div>
    </div>
    <p class="instructions"><strong>Orientações:</strong> ${escapeHtml(activity.instructions)}</p>
    ${questionsHtml}
  `;

  const answerHtml = activity.questions.map(q => `<div class="answer-key-item"><strong>${q.number}.</strong> ${escapeHtml(q.answer)}</div>`).join('');
  teacherPreview.innerHTML = `
    <div class="paper-header">
      <div class="teacher-badge">USO EXCLUSIVO DO PROFESSOR</div>
      <h1>Gabarito — ${escapeHtml(activity.title)}</h1>
      <p>${escapeHtml(activity.grade)} • ${escapeHtml(activity.subject)}</p>
    </div>
    <div class="answer-key">${answerHtml}</div>
  `;

  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveHistory(activity, payload) {
  const history = JSON.parse(localStorage.getItem('aulafacil_history') || '[]');
  history.unshift({ id: crypto.randomUUID(), activity, payload, savedAt: new Date().toISOString() });
  localStorage.setItem('aulafacil_history', JSON.stringify(history.slice(0, 20)));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formPayload();
  if (!payload.topic) return;
  setLoading(true);
  try {
    currentActivity = await generateActivity(payload);
    renderActivity(currentActivity);
    saveHistory(currentActivity, payload);
  } finally {
    setLoading(false);
  }
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    const showTeacher = tab.dataset.tab === 'teacher';
    studentPreview.classList.toggle('hidden', showTeacher);
    teacherPreview.classList.toggle('hidden', !showTeacher);
  });
});

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(String(text), maxWidth);
}

function downloadPdf(mode) {
  if (!currentActivity) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const width = 210 - margin * 2;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const title = mode === 'student' ? currentActivity.title : `Gabarito — ${currentActivity.title}`;
  doc.text(wrapText(doc, title, width), 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${currentActivity.grade} • ${currentActivity.subject}`, 105, y, { align: 'center' });
  y += 9;

  if (mode === 'student') {
    doc.line(margin, y, 194, y); y += 10;
    doc.text('Aluno(a): _______________________________', margin, y);
    doc.text('Turma: __________', 128, y);
    doc.text('Data: ___/___/____', 163, y);
    y += 10;
    doc.setFont('helvetica', 'bold'); doc.text('Orientações:', margin, y);
    doc.setFont('helvetica', 'normal');
    const inst = wrapText(doc, currentActivity.instructions, width - 25);
    doc.text(inst, margin + 24, y);
    y += Math.max(10, inst.length * 5 + 4);
  } else {
    doc.setFillColor(20, 20, 20); doc.rect(62, y - 5, 86, 8, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('USO EXCLUSIVO DO PROFESSOR', 105, y, {align:'center'});
    doc.setTextColor(0,0,0); y += 12;
  }

  currentActivity.questions.forEach((q) => {
    const body = mode === 'student' ? `${q.number}. ${q.prompt}` : `${q.number}. ${q.answer}`;
    const lines = wrapText(doc, body, width);
    const needed = lines.length * 5 + (mode === 'student' && !q.options ? 15 : 8);
    if (y + needed > 285) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', mode === 'student' ? 'bold' : 'normal');
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
    if (mode === 'student' && q.options) {
      doc.setFont('helvetica','normal');
      q.options.forEach((opt, idx) => { doc.text(`(${String.fromCharCode(65+idx)}) ${opt}`, margin + 4, y); y += 5; });
      y += 3;
    } else if (mode === 'student') {
      doc.line(margin, y + 4, 194, y + 4);
      doc.line(margin, y + 10, 194, y + 10);
      y += 16;
    } else {
      y += 5;
    }
  });

  const safeTopic = currentActivity.topic.replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '-').toLowerCase();
  doc.save(mode === 'student' ? `atividade-${safeTopic}.pdf` : `gabarito-${safeTopic}.pdf`);
}

document.getElementById('downloadStudentBtn').addEventListener('click', () => downloadPdf('student'));
document.getElementById('downloadTeacherBtn').addEventListener('click', () => downloadPdf('teacher'));
document.getElementById('editBtn').addEventListener('click', () => generatorSection.scrollIntoView({ behavior: 'smooth' }));
document.getElementById('regenerateBtn').addEventListener('click', () => form.requestSubmit());

document.getElementById('historyBtn').addEventListener('click', () => {
  renderHistory();
  historyModal.classList.remove('hidden');
});
document.getElementById('closeHistoryBtn').addEventListener('click', () => historyModal.classList.add('hidden'));
historyModal.addEventListener('click', (e) => { if (e.target === historyModal) historyModal.classList.add('hidden'); });

function renderHistory() {
  const list = document.getElementById('historyList');
  const history = JSON.parse(localStorage.getItem('aulafacil_history') || '[]');
  if (!history.length) {
    list.innerHTML = '<div class="empty-state">Nenhuma atividade salva ainda.</div>';
    return;
  }
  list.innerHTML = history.map(item => `
    <div class="history-item">
      <div>
        <h3>${escapeHtml(item.activity.topic)}</h3>
        <p>${escapeHtml(item.activity.subject)} • ${escapeHtml(item.activity.grade)} • ${new Date(item.savedAt).toLocaleDateString('pt-BR')}</p>
      </div>
      <button data-id="${item.id}">Abrir</button>
    </div>
  `).join('');
  list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    const item = history.find(entry => entry.id === button.dataset.id);
    if (!item) return;
    currentActivity = item.activity;
    renderActivity(currentActivity);
    historyModal.classList.add('hidden');
  }));
}
