const Store={
 getUsers:()=>JSON.parse(localStorage.getItem('ativaedu_users')||'[]'),
 saveUsers:v=>localStorage.setItem('ativaedu_users',JSON.stringify(v)),
 getSession:()=>JSON.parse(localStorage.getItem('ativaedu_session')||'null'),
 setSession:v=>localStorage.setItem('ativaedu_session',JSON.stringify(v)),
 clearSession:()=>localStorage.removeItem('ativaedu_session'),
 getActivities:()=>JSON.parse(localStorage.getItem('ativaedu_activities')||'[]'),
 saveActivities:v=>localStorage.setItem('ativaedu_activities',JSON.stringify(v)),
 getReports:()=>JSON.parse(localStorage.getItem('ativaedu_reports')||'[]'),
 saveReports:v=>localStorage.setItem('ativaedu_reports',JSON.stringify(v))
};
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.remove(),3000)}
function requireAuth(){const s=Store.getSession();if(!s){location.href='login.html';return null}return s}
function logout(){Store.clearSession();location.href='login.html'}
function qs(n){return new URLSearchParams(location.search).get(n)}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
