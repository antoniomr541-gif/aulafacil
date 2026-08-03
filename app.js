let supabaseClient=null,currentUser=null,currentActivity=null,currentReport=null,profile={name:'',school:'',logo:''};
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showView(name){['login','register','forgot','reset'].forEach(v=>$(v+'Panel').classList.toggle('hidden',v!==name));$('authMessage').classList.add('hidden')}
function msg(text){$('authMessage').textContent=text;$('authMessage').classList.remove('hidden')}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
async function init(){try{const c=await fetch('/api/config').then(r=>r.json());if(!c.supabaseUrl||!c.supabaseAnonKey)throw 0;supabaseClient=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey);supabaseClient.auth.onAuthStateChange((e,s)=>{if(e==='PASSWORD_RECOVERY')showView('reset');else updateSession(s?.user||null)});const {data}=await supabaseClient.auth.getSession();updateSession(data.session?.user||null)}catch{msg('Configure SUPABASE_URL e SUPABASE_ANON_KEY no Vercel.')}}
function key(){return `aulafacil_profile_${currentUser?.id||'none'}`}
function updateSession(user){currentUser=user;if(!user){$('authScreen').classList.remove('hidden');$('app').classList.add('hidden');return}$('authScreen').classList.add('hidden');$('app').classList.remove('hidden');profile=JSON.parse(localStorage.getItem(key())||'{}');if(!profile.name)profile.name=user.user_metadata?.full_name||'';refreshProfile();if(!profile.school)setTimeout(()=>openProfile(),200)}
function refreshProfile(){$('welcomeName').textContent=profile.name||'Professor(a)';$('summarySchool').textContent=profile.school||'Configure seu perfil';$('profileName').value=profile.name||'';$('profileSchool').value=profile.school||'';['summaryLogo','logoPreview'].forEach(id=>{const el=$(id);if(profile.logo){el.src=profile.logo;el.style.display='block'}else el.style.display='none'})}
$('loginForm').onsubmit=async e=>{e.preventDefault();const {error}=await supabaseClient.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error)msg('E-mail ou senha incorretos.')};
$('registerForm').onsubmit=async e=>{e.preventDefault();if($('registerPassword').value!==$('registerConfirm').value)return msg('As senhas não são iguais.');const {data,error}=await supabaseClient.auth.signUp({email:$('registerEmail').value.trim(),password:$('registerPassword').value,options:{data:{full_name:$('registerName').value.trim()},emailRedirectTo:location.origin}});if(error)return msg(error.message);if(!data.session){showView('login');msg('Conta criada. Confirme seu e-mail para entrar.')}};
$('forgotForm').onsubmit=async e=>{e.preventDefault();const {error}=await supabaseClient.auth.resetPasswordForEmail($('forgotEmail').value.trim(),{redirectTo:location.origin});msg(error?error.message:'Link enviado para seu e-mail.')};
$('resetForm').onsubmit=async e=>{e.preventDefault();if($('resetPassword').value!==$('resetConfirm').value)return msg('As senhas não são iguais.');const {error}=await supabaseClient.auth.updateUser({password:$('resetPassword').value});msg(error?error.message:'Senha alterada com sucesso.')};
$('logoutBtn').onclick=()=>supabaseClient.auth.signOut();
function openProfile(){$('profileModal').classList.remove('hidden');refreshProfile()} $('profileBtn').onclick=openProfile;$('closeProfile').onclick=()=>{$('profileModal').classList.add('hidden')};
$('profileLogo').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>1200000)return alert('Escolha uma imagem com até 1,2 MB.');const r=new FileReader();r.onload=()=>{profile.logo=r.result;$('logoPreview').src=r.result;$('logoPreview').style.display='block'};r.readAsDataURL(f)};
$('profileForm').onsubmit=e=>{e.preventDefault();profile.name=$('profileName').value.trim();profile.school=$('profileSchool').value.trim();localStorage.setItem(key(),JSON.stringify(profile));refreshProfile();$('profileModal').classList.add('hidden')};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===b));$('activityPage').classList.toggle('hidden',b.dataset.page!=='activity');$('reportPage').classList.toggle('hidden',b.dataset.page!=='report')});
function logoHtml(){return profile.logo?`<img src="${profile.logo}" alt="Logo">`:`<div style="width:72px;height:72px;border:1px dashed #aaa;display:grid;place-items:center;font-size:11px">LOGO</div>`}
function headerHtml(extra=''){return `<div class="worksheet-head">${logoHtml()}<div><h2>${esc(profile.school||'Nome da escola')}</h2><p>Professor(a): <strong>${esc(profile.name||'Professor(a)')}</strong></p>${extra}</div></div>`}
function validateClientActivity(a,p){
  if(!a)throw new Error('A atividade retornada está vazia.');
  if(p.activityMode==='coloring'){
    if(a.mode!=='coloring'||!a.painting||!Array.isArray(a.painting.elements))throw new Error('A atividade de pintura retornada está incompleta.');
    return a;
  }
  if(!Array.isArray(a.questions)||a.questions.length!==p.quantity)throw new Error('A atividade retornada está incompleta.');
  const requested=String(p.questionType).toLowerCase();
  a.questions.forEach((q,i)=>{
    q.number=i+1;
    if(q.type==='objective'){
      if(!Array.isArray(q.options)||q.options.length!==4)throw new Error(`A questão ${i+1} não possui quatro alternativas.`);
      if(!['A','B','C','D'].includes(q.correctOption))throw new Error(`O gabarito da questão ${i+1} está inválido.`);
      q.answer=q.answer||`${q.correctOption}) ${q.options['ABCD'.indexOf(q.correctOption)]}`;
    }else{
      q.type='discursive';q.options=null;q.answer=q.answer||q.expectedAnswer;
      if(!q.answer)throw new Error(`A resposta da questão ${i+1} está vazia.`);
    }
  });
  if(requested.includes('objet')&&a.questions.some(q=>q.type!=='objective'))throw new Error('A IA retornou questão discursiva em uma atividade objetiva.');
  if(requested.includes('disc')&&a.questions.some(q=>q.type!=='discursive'))throw new Error('A IA retornou questão objetiva em uma atividade discursiva.');
  return a;
}

$('activityForm').onsubmit=async e=>{e.preventDefault();if(!profile.name||!profile.school)return openProfile();const p={activityMode:$('activityMode').value,subject:$('subject').value,grade:$('grade').value,topic:$('topic').value.trim(),quantity:Number($('quantity').value),difficulty:$('difficulty').value,questionType:$('questionType').value,printStyle:$('printStyle').value,illustrations:$('illustrations').value,autism:$('autism').value,extraInstructions:$('extra').value.trim()};$('generateBtn').disabled=true;$('generateBtn').textContent='Gerando...';try{const r=await fetch('/api/generate-activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Erro ao gerar atividade.');currentActivity=validateClientActivity(data,p);renderActivity()}catch(error){console.error(error);alert(error.message||'Não foi possível gerar a atividade. Tente novamente.')}finally{$('generateBtn').disabled=false;$('generateBtn').textContent='Gerar atividade'}};
function iconMarkup(kind,x,y,s,filled=false,label=''){
  const stroke='#222', fill=filled?'#eee':'white', sw=Math.max(2,s*.035);
  const common=`stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round"`;
  const k=String(kind||'star').toLowerCase();
  let body='';
  if(k==='apple')body=`<path ${common} d="M ${x} ${y+s*.25} C ${x-s*.36} ${y-s*.15},${x-s*.5} ${y+s*.62},${x} ${y+s*.7} C ${x+s*.5} ${y+s*.62},${x+s*.36} ${y-s*.15},${x} ${y+s*.25} Z"/><path ${common} fill="none" d="M${x} ${y+s*.18} Q${x+s*.06} ${y-s*.18} ${x+s*.22} ${y-s*.25}"/><path ${common} d="M${x+s*.08} ${y-s*.15} Q${x+s*.34} ${y-s*.35} ${x+s*.42} ${y-s*.08} Q${x+s*.24} ${y} ${x+s*.08} ${y-s*.15}Z"/>`;
  else if(k==='flower')body=`<circle ${common} cx="${x}" cy="${y}" r="${s*.14}"/>${[0,60,120,180,240,300].map(a=>{const r=a*Math.PI/180,cx=x+Math.cos(r)*s*.28,cy=y+Math.sin(r)*s*.28;return `<ellipse ${common} cx="${cx}" cy="${cy}" rx="${s*.15}" ry="${s*.22}" transform="rotate(${a+90} ${cx} ${cy})"/>`}).join('')}<path ${common} fill="none" d="M${x} ${y+s*.15} L${x} ${y+s*.65} M${x} ${y+s*.46} Q${x-s*.3} ${y+s*.35} ${x-s*.28} ${y+s*.58} M${x} ${y+s*.5} Q${x+s*.3} ${y+s*.38} ${x+s*.28} ${y+s*.62}"/>`;
  else if(k==='sun')body=`<circle ${common} cx="${x}" cy="${y}" r="${s*.28}"/>${[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return `<line ${common} x1="${x+Math.cos(r)*s*.39}" y1="${y+Math.sin(r)*s*.39}" x2="${x+Math.cos(r)*s*.58}" y2="${y+Math.sin(r)*s*.58}"/>`}).join('')}`;
  else if(k==='cloud')body=`<path ${common} d="M${x-s*.45} ${y+s*.18} Q${x-s*.52} ${y-s*.1} ${x-s*.25} ${y-s*.14} Q${x-s*.12} ${y-s*.46} ${x+s*.15} ${y-s*.25} Q${x+s*.46} ${y-s*.28} ${x+s*.45} ${y+s*.05} Q${x+s*.58} ${y+s*.28} ${x+s*.28} ${y+s*.32} L${x-s*.3} ${y+s*.32} Q${x-s*.48} ${y+s*.3} ${x-s*.45} ${y+s*.18}Z"/>`;
  else if(k==='fish')body=`<ellipse ${common} cx="${x}" cy="${y}" rx="${s*.38}" ry="${s*.24}"/><path ${common} d="M${x-s*.38} ${y} L${x-s*.62} ${y-s*.25} L${x-s*.62} ${y+s*.25}Z"/><circle ${common} fill="#222" cx="${x+s*.2}" cy="${y-s*.05}" r="${s*.035}"/>`;
  else if(k==='butterfly')body=`<ellipse ${common} cx="${x}" cy="${y}" rx="${s*.07}" ry="${s*.32}"/><ellipse ${common} cx="${x-s*.23}" cy="${y-s*.13}" rx="${s*.22}" ry="${s*.27}" transform="rotate(-25 ${x-s*.23} ${y-s*.13})"/><ellipse ${common} cx="${x+s*.23}" cy="${y-s*.13}" rx="${s*.22}" ry="${s*.27}" transform="rotate(25 ${x+s*.23} ${y-s*.13})"/><ellipse ${common} cx="${x-s*.2}" cy="${y+s*.18}" rx="${s*.16}" ry="${s*.2}"/><ellipse ${common} cx="${x+s*.2}" cy="${y+s*.18}" rx="${s*.16}" ry="${s*.2}"/><path ${common} fill="none" d="M${x-s*.02} ${y-s*.3} Q${x-s*.18} ${y-s*.55} ${x-s*.28} ${y-s*.48} M${x+s*.02} ${y-s*.3} Q${x+s*.18} ${y-s*.55} ${x+s*.28} ${y-s*.48}"/>`;
  else if(k==='tree')body=`<rect ${common} x="${x-s*.1}" y="${y+s*.08}" width="${s*.2}" height="${s*.52}"/><circle ${common} cx="${x}" cy="${y-s*.08}" r="${s*.34}"/><circle ${common} cx="${x-s*.25}" cy="${y+s*.04}" r="${s*.24}"/><circle ${common} cx="${x+s*.25}" cy="${y+s*.04}" r="${s*.24}"/>`;
  else if(k==='house')body=`<rect ${common} x="${x-s*.38}" y="${y-s*.02}" width="${s*.76}" height="${s*.55}"/><path ${common} d="M${x-s*.48} ${y} L${x} ${y-s*.45} L${x+s*.48} ${y}Z"/><rect ${common} x="${x-s*.1}" y="${y+s*.2}" width="${s*.2}" height="${s*.33}"/><rect ${common} x="${x-s*.3}" y="${y+s*.1}" width="${s*.16}" height="${s*.16}"/>`;
  else if(k==='book')body=`<path ${common} d="M${x} ${y-s*.3} Q${x-s*.35} ${y-s*.42} ${x-s*.48} ${y-s*.22} L${x-s*.48} ${y+s*.38} Q${x-s*.26} ${y+s*.18} ${x} ${y+s*.33}Z"/><path ${common} d="M${x} ${y-s*.3} Q${x+s*.35} ${y-s*.42} ${x+s*.48} ${y-s*.22} L${x+s*.48} ${y+s*.38} Q${x+s*.26} ${y+s*.18} ${x} ${y+s*.33}Z"/><line ${common} x1="${x}" y1="${y-s*.3}" x2="${x}" y2="${y+s*.33}"/>`;
  else if(k==='pencil')body=`<path ${common} d="M${x-s*.45} ${y+s*.12} L${x+s*.28} ${y-s*.34} L${x+s*.45} ${y-s*.06} L${x-s*.28} ${y+s*.4}Z"/><path ${common} d="M${x-s*.45} ${y+s*.12} L${x-s*.55} ${y+s*.5} L${x-s*.28} ${y+s*.4}Z"/>`;
  else if(k==='planet')body=`<circle ${common} cx="${x}" cy="${y}" r="${s*.28}"/><ellipse ${common} fill="none" cx="${x}" cy="${y}" rx="${s*.55}" ry="${s*.17}" transform="rotate(-15 ${x} ${y})"/>`;
  else if(k==='heart')body=`<path ${common} d="M${x} ${y+s*.45} C${x-s*.55} ${y+s*.05},${x-s*.48} ${y-s*.35},${x-s*.18} ${y-s*.28} C${x-s*.04} ${y-s*.25},${x} ${y-s*.12},${x} ${y-s*.04} C${x} ${y-s*.12},${x+s*.04} ${y-s*.25},${x+s*.18} ${y-s*.28} C${x+s*.48} ${y-s*.35},${x+s*.55} ${y+s*.05},${x} ${y+s*.45}Z"/>`;
  else if(k==='triangle')body=`<path ${common} d="M${x} ${y-s*.4} L${x-s*.42} ${y+s*.38} L${x+s*.42} ${y+s*.38}Z"/>`;
  else if(k==='square')body=`<rect ${common} x="${x-s*.38}" y="${y-s*.38}" width="${s*.76}" height="${s*.76}" rx="${s*.04}"/>`;
  else if(k==='circle'||k==='ball')body=`<circle ${common} cx="${x}" cy="${y}" r="${s*.38}"/>${k==='ball'?`<path ${common} fill="none" d="M${x-s*.32} ${y-s*.18} Q${x} ${y} ${x+s*.32} ${y-s*.18} M${x-s*.3} ${y+s*.2} Q${x} ${y} ${x+s*.3} ${y+s*.2}"/>`:''}`;
  else body=`<path ${common} d="M${x} ${y-s*.45} L${x+s*.13} ${y-s*.14} L${x+s*.47} ${y-s*.14} L${x+s*.2} ${y+s*.08} L${x+s*.3} ${y+s*.42} L${x} ${y+s*.22} L${x-s*.3} ${y+s*.42} L${x-s*.2} ${y+s*.08} L${x-s*.47} ${y-s*.14} L${x-s*.13} ${y-s*.14}Z"/>`;
  return `<g>${body}${label?`<text x="${x}" y="${y+s*.82}" text-anchor="middle" font-family="Arial" font-size="${s*.18}" fill="#222">${esc(label)}</text>`:''}</g>`;
}
function illustrationSvg(spec,large=false){
  if(!spec)return'';const elements=Array.isArray(spec.elements)?spec.elements:[spec];const width=700,height=large?620:230;let parts='';let slots=[];
  elements.forEach(el=>{const count=Math.min(Math.max(Number(el.count)||1,1),large?8:10);for(let i=0;i<count;i++)slots.push({...el,instance:i})});
  const cols=large?3:Math.min(5,Math.max(1,slots.length));const rows=Math.ceil(slots.length/cols);const cellW=width/cols,cellH=(height-50)/Math.max(rows,1);const size=Math.min(cellW,cellH)*(large?.55:.5);
  slots.forEach((el,i)=>{const col=i%cols,row=Math.floor(i/cols),x=cellW*(col+.5),y=cellH*(row+.5)+15;parts+=iconMarkup(el.kind,x,y,size,false,el.label&&el.instance===0?el.label:'')});
  const title=esc(spec.title||spec.label||'');return `<div class="illustration-card"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">${parts}</svg>${spec.caption?`<div style="text-align:center;font-size:12px">${esc(spec.caption)}</div>`:''}</div>`;
}

function cleanAnswer(answer){
  let value=String(answer||'').trim();
  value=value.replace(/^([A-D])\)\s*\1\)\s*/i,'$1) ');
  value=value.replace(/^([A-D])[\.\-:]\s*\1[\.\-:]\s*/i,'$1) ');
  return value;
}

function renderActivity(){
  const a=currentActivity;
  if(a.mode==='coloring'){
    const scene={...a.painting,elements:a.painting.elements||[]};
    $('studentPreview').innerHTML=`${headerHtml()}<div class="student-fields"><div class="line">Aluno(a):</div><div class="line">Data:</div></div><div class="paper-title"><h2>${esc(a.title)}</h2><p>${esc(a.grade||'')}</p></div><p><strong>Orientação:</strong> ${esc(a.instructions||a.painting.instruction||'Pinte o desenho com capricho.')}</p><div class="painting-sheet">${illustrationSvg(scene,true)}${(a.painting.traceWords||[]).length?`<div class="trace-words">${a.painting.traceWords.map(w=>`<span class="trace-word">${esc(w)}</span>`).join('')}</div>`:''}</div>`;
    $('teacherPreview').innerHTML=`${headerHtml('<span class="exclusive">USO EXCLUSIVO DO PROFESSOR</span>')}<div class="paper-title"><h2>Orientações — ${esc(a.title)}</h2></div><p>${esc(a.painting.teacherNote||'Atividade lúdica de pintura, coordenação motora e reconhecimento do tema.')}</p>`;
  }else{
    const q=a.questions.map(x=>`<div class="question question-with-art"><strong>${x.number}. ${esc(x.prompt)}</strong>${x.illustration&&x.illustration.kind?illustrationSvg(x.illustration):''}${x.options?`<div class="options">${x.options.map((o,i)=>`<span>(${String.fromCharCode(65+i)}) ${esc(o)}</span>`).join('')}</div>`:'<div class="answer-lines"></div>'}</div>`).join('');
    $('studentPreview').innerHTML=`${headerHtml()}<div class="student-fields"><div class="line">Aluno(a):</div><div class="line">Data:</div></div><div class="paper-title"><h2>${esc(a.title)}</h2><p>${esc(a.grade)} • ${esc(a.difficulty||'')}</p></div><p><strong>Orientações:</strong> ${esc(a.instructions)}</p>${q}`;
    $('teacherPreview').innerHTML=`${headerHtml('<span class="exclusive">USO EXCLUSIVO DO PROFESSOR</span>')}<div class="paper-title"><h2>Gabarito — ${esc(a.title)}</h2></div>${a.questions.map(x=>`<p><strong>${x.number}.</strong> ${esc(cleanAnswer(x.answer))}</p>`).join('')}`;
  }
  $('activityResult').classList.remove('hidden');$('activityResult').scrollIntoView({behavior:'smooth'});
}

document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));$('studentPreview').classList.toggle('hidden',b.dataset.tab!=='student');$('teacherPreview').classList.toggle('hidden',b.dataset.tab!=='teacher')});
function makePdf(elementId,file){const {jsPDF}=window.jspdf;const el=$(elementId);const doc=new jsPDF({unit:'pt',format:'a4'});doc.html(el,{callback:d=>d.save(file),x:25,y:25,width:545,windowWidth:794,html2canvas:{scale:.72,useCORS:true}})}
$('studentPdf').onclick=()=>makePdf('studentPreview','atividade-aluno.pdf');$('teacherPdf').onclick=()=>makePdf('teacherPreview','gabarito-professor.pdf');$('newActivity').onclick=()=>{$('activityResult').classList.add('hidden');$('activityForm').reset();scrollTo({top:0,behavior:'smooth'})};
$('reportForm').onsubmit=e=>{e.preventDefault();if(!profile.name||!profile.school)return openProfile();const d={type:$('reportType').value,clazz:$('reportClass').value,period:$('reportPeriod').value,student:$('reportStudent').value,situation:$('reportSituation').value,difficulties:$('reportDifficulties').value,actions:$('reportActions').value,results:$('reportResults').value,next:$('reportNext').value};currentReport=`Durante o período ${d.period}, na turma ${d.clazz}${d.student?`, com atenção ao(à) estudante ${d.student}`:''}, observou-se o seguinte: ${d.situation}\n\nAs principais dificuldades identificadas foram: ${d.difficulties||'não foram registradas dificuldades específicas'}.\n\nAs ações pedagógicas realizadas incluíram: ${d.actions||'acompanhamento contínuo e orientações em sala'}.\n\nQuanto aos resultados, percebeu-se: ${d.results||'a necessidade de continuidade do acompanhamento'}.\n\nComo encaminhamentos para o próximo período, recomenda-se: ${d.next||'manter o acompanhamento pedagógico e reavaliar as estratégias adotadas'}.`; $('reportPreview').innerHTML=`${headerHtml()}<div class="paper-title"><h2>${esc(d.type)}</h2><p>Turma: ${esc(d.clazz)} • Período: ${esc(d.period)}</p></div><div class="report-text">${esc(currentReport)}</div><div style="margin-top:70px;display:grid;grid-template-columns:1fr 1fr;gap:35px"><div class="line">Data:</div><div class="line">Assinatura:</div></div>`;$('reportResult').classList.remove('hidden');$('reportResult').scrollIntoView({behavior:'smooth'})};
$('reportPdf').onclick=()=>makePdf('reportPreview','relatorio-ac.pdf');$('newReport').onclick=()=>{$('reportResult').classList.add('hidden');$('reportForm').reset()};

function syncActivityOptions(){
  const coloring=$('activityMode').value==='coloring';
  ['quantityField','difficultyField','questionTypeField'].forEach(id=>$(id).classList.toggle('field-muted',coloring));
  $('quantity').disabled=coloring;$('difficulty').disabled=coloring;$('questionType').disabled=coloring;
  const infantil=$('grade').value==='Educação Infantil'||$('subject').value==='Educação Infantil';
  if(infantil&&!coloring&&$('illustrations').value==='none')$('illustrations').value='visual';
  $('illustrations').disabled=coloring||infantil;
  if(coloring)$('illustrations').value='visual';
  $('illustrationHint').textContent=coloring?'A atividade de pintura sempre gera um desenho grande para imprimir.':infantil?'Na Educação Infantil, a atividade sempre será lúdica e ilustrada.':'Os desenhos só aparecem quando esta opção for escolhida.';
}
$('activityMode').onchange=syncActivityOptions;$('grade').onchange=syncActivityOptions;$('subject').onchange=syncActivityOptions;
syncActivityOptions();
init();
