import {createEngine,CONTACT,OFFICIAL} from './engine.mjs';
const $=id=>document.getElementById(id),chat=$('conversation');
let engine,tree,tests,state={},navStack=[],misses=0,lastQuestion='',busy=false,replyToken=0;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:OFFICIAL;}catch{return OFFICIAL;}};
const scroll=()=>requestAnimationFrame(()=>chat.scrollTo({top:chat.scrollHeight,behavior:'smooth'}));
function bot(content,kind='neutral'){const e=document.createElement('section');e.className='message bot response-'+kind;e.innerHTML='<div class="bot-label"><span>✳</span>低碳家園小幫手</div><div class="bot-content">'+content+'</div>';chat.append(e);scroll();return e;}
function user(text){const e=document.createElement('div');e.className='message user';const b=document.createElement('div');b.className='user-bubble';b.textContent=text;e.append(b);chat.append(e);}
function choice(label,action,data){return `<button class="choice" data-action="${action}" data-value="${escape(data)}">${escape(label)}</button>`;}
function questionLabel(q){return q.question+(q.needsReview?'（待確認）':'');}
function sources(q){const unique=[];for(const s of q.sources||[]){const key=s.url||s.title+'|'+s.location;if(!unique.some(x=>x.key===key))unique.push({...s,key});}const official=unique.filter(s=>s.url);let html='<div class="sources">資料依據';if(official.length)html+=official.slice(0,3).map(s=>`<a href="${escape(safeUrl(s.url))}" target="_blank" rel="noopener">${escape(s.title)} ↗<small>${escape(s.location||'')}</small></a>`).join('');else{html+='<p class="source-provenance">'+escape(unique.map(s=>s.title+' · '+s.location).join('；'))+'</p><a href="'+OFFICIAL+'LcssViewPage/ab/EvalInfoDownload.aspx" target="_blank" rel="noopener">查閱官方下載專區 ↗</a><small>此連結為查找入口，並非本題已核對的原文頁面。</small>';}return html+'</div>';}
function showAnswer(q){if(busy)return;if(!q){display(engine.result(q));return;}state={};lastQuestion=q.question;user(q.question);pacedReply(()=>display(engine.result(q)));}
function display(r){
 if(r.type==='human'){showContact();return;}
 if(r.type==='answer'||r.type==='navigation'){
  const q=r.items[0];let body=escape(r.text);
  if(q.kind==='案例原文'&&r.text.length>550){let cut=r.text.indexOf('\n');if(cut<100)cut=450;body=escape(r.text.slice(0,cut))+`<details class="answer-details"><summary>閱讀完整案例</summary><p>${escape(r.text.slice(cut))}</p></details>`;}
  bot(`<div class="result-badge">${r.type==='navigation'?'↗ 官方查詢指引':'✓ 已找到題庫答案'}</div><div class="crumb">${escape(q.path.join(' / '))}</div><h2 class="answer-title">${escape(q.question)}</h2><div class="answer-text">${body}</div>${sources(q)}<div class="choices">${choice('相關問題','related',q.id)}${choice('回主選單','home','')}</div>`,r.type);misses=0;
 }else if(r.type==='candidates'){
  bot(`<div class="result-badge">? 可能相關，請選擇</div><p>${escape(r.text)}</p><div class="candidates">${r.items.map(q=>`<button class="candidate" data-action="answer" data-value="${q.id}">${escape(questionLabel(q))}<small>${escape(q.path.slice(0,2).join(' / '))}</small></button>`).join('')}</div><div class="choices">${choice('這些都不是','miss','')}${choice('聯絡客服','contact','')}</div>`,'candidates');misses++;
 }else if(r.type==='review'){
  const q=r.items[0];bot(`<div class="status-label">這題需要進一步確認</div><h2 class="answer-title">${escape(q.question)}</h2><p>${escape(r.text)}</p>${sources(q)}<div class="choices">${choice('聯絡客服','contact','')}${choice('回主選單','home','')}</div>`,'review');misses++;
 }else{
  const labels={correction:'? 可能有錯字，請確認',clarify:'? 還需要一點資訊',multiple:'? 請選擇要處理的問題',unrelated:'服務範圍說明','no-match':'? 暫時無法確認',insufficient:'! 主題已辨識，資料不足',missing:'! 資料尚未收錄',private:'↗ 請至官方系統查詢'};let content=(labels[r.type]?`<div class="result-badge">${labels[r.type]}</div>`:'')+`<p>${escape(r.text)}</p>`;if(r.corrections)content+=`<div class="correction-note">可能的用詞：${escape(r.corrections.join('、'))}</div>`;
  if(r.referenceLabel)content+=`<div class="reference-label">${escape(r.referenceLabel)}</div>`;
  if(r.choices)content+='<div class="choices">'+r.choices.map(c=>choice(c.label,c.category?'category':'query',c.category||c.query)).join('')+'</div>';
  if(r.type==='correction')content+='<div class="choices">'+choice('不是，回主選單','home','')+'</div>';
  if(r.url)content+=`<a class="external-link" href="${escape(safeUrl(r.url))}" target="_blank" rel="noopener">前往官方查詢 ↗</a>`;
  if(['no-match','unrelated','missing','insufficient','private','greeting','empty','too-long'].includes(r.type))content+='<div class="choices">'+choice('回主選單','home','')+choice('聯絡客服','contact','')+'</div>';
  bot(content,r.type);if(['no-match','missing','insufficient','clarify','correction'].includes(r.type))misses++;
 }
 if(misses>=2&&r.type!=='unrelated'){bot('<p>還沒找到你要的資訊嗎？可以用按鈕查詢，或直接聯絡官方客服。</p><div class="choices">'+choice('用按鈕查詢','home','')+choice('聯絡官方客服','contact','')+'</div>');misses=0;}
 syncContext();
}
function syncContext(){const parts=[state.level,state.grade,state.year?state.year+'年':null].filter(Boolean);$('context-line').hidden=!parts.length;$('context-line').textContent='目前查詢條件：'+parts.join(' · ');$('back-button').disabled=navStack.length<2;}
function setBusy(value){busy=value;chat.setAttribute('aria-busy',String(value));document.querySelectorAll('#composer button,#conversation button,#home-button,#back-button,#contact-button').forEach(b=>b.disabled=value);if(!value)syncContext();}
async function pacedReply(run){if(busy)return;const token=++replyToken;setBusy(true);const pending=bot('<div class="thinking"><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="thinking-text">正在查詢公開題庫…</span></div>');await new Promise(r=>setTimeout(r,650));if(token!==replyToken)return;pending.querySelector('.thinking-text').textContent='正在核對問題與資料來源…';await new Promise(r=>setTimeout(r,650));if(token!==replyToken)return;pending.remove();setBusy(false);run();}
function ask(text){if(!engine||busy)return;lastQuestion=text;user(text||'（未輸入問題）');pacedReply(()=>{const r=engine.search(text,state);state=r.state||state;display(r);});}
function showContact(){
 bot(`<h2 class="answer-title">聯絡官方客服</h2><p>由原網站提供的管道協助處理制度、操作或個案問題。請勿在此輸入密碼或身分證字號。</p><div class="contact-card"><h3>系統操作及制度問題</h3><p>電話：(02) 2515-0369 轉113</p><p>信箱：ee@ier.org.tw</p><p>服務時間：週一至週五 09:00–18:00，假日請來信。</p><p>資料依官方「聯絡我們」頁面，聯絡方式如有異動，以原頁為準。</p><div class="contact-actions"><a href="tel:+886225150369">撥打客服電話</a><a href="mailto:ee@ier.org.tw">開啟電子郵件</a><a href="${CONTACT}" target="_blank" rel="noopener">官方聯絡頁 ↗</a><button data-action="copy">複製本次問題</button></div></div><p class="welcome-foot">本頁尚未串接真人客服或派案系統，開啟聯絡頁不代表已建立案件。</p>`);
}
function findNode(id,n=tree){if(n.id===id)return n;for(const c of n.children||[]){const r=findNode(id,c);if(r)return r;}}
function home(reset=true){if(reset){state={};navStack=[];}if(navStack.at(-1)!==tree.id)navStack.push(tree.id);document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));bot(`<h2 class="answer-title">你好，今天想了解什麼？</h2><p>選一個主題，或直接在下方輸入問題。</p><div class="tiles">${tree.children.map(n=>`<button class="tile" data-action="node" data-value="${n.id}"><span>${escape(n.label)}</span><span aria-hidden="true">›</span></button>`).join('')}</div><div class="choices">${choice('村里銅級申請條件','query','村里申請銅級評等的門檻是什麼？')}${choice('綠色團隊要幾人','query','綠色團隊人數有何規定？')}</div><p class="welcome-foot">需要最新數量或個案進度？我會帶你前往官方查詢。</p>`);syncContext();}
function showNode(id,push=true,page=0){
 const n=findNode(id);if(!n){display(engine.result(null));return;}
 if(n.qa_id){showAnswer(engine.byId(n.qa_id));return;}
 if(n.type==='gap'){display({type:'missing',text:'目前尚未收錄115年度競賽辦法與獲獎資料，請以官方最新公告為準。',url:OFFICIAL+'LcssViewPage/ab/villages/activity-detail3.aspx'});return;}
 if(n.id===tree.id){home(false);return;}
 if(push){navStack.push(id);state={};}
 const children=n.children||[];if(!children.length){display({type:'missing',text:'此分類尚未收錄資料，請查看官方公告或聯絡客服。',url:OFFICIAL});return;}const slice=children.slice(page*6,page*6+6);const path=findPath(id);document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.value===path[0]?.id));
 const allAnswers=slice.every(c=>c.qa_id);
 bot(`<div class="crumb">${escape(path.map(p=>p.label).join(' / '))}</div><h2 class="answer-title">${escape(n.label)}</h2><p>${allAnswers?'你想了解哪一個問題？':'請選擇你想查詢的項目。'}</p><div class="${allAnswers?'candidates':'tiles'}">${slice.map(c=>`<button class="${allAnswers?'candidate':'tile'}" data-action="node" data-value="${c.id}"><span>${escape(c.qa_id&&engine.byId(c.qa_id)?.needsReview?c.label+'（待確認）':c.label)}</span>${!allAnswers?'<span aria-hidden="true">›</span>':''}</button>`).join('')}</div>${children.length>6?`<div class="choices">${page?choice('上一頁','page',id+':'+(page-1)):''}${(page+1)*6<children.length?choice('更多問題 →','page',id+':'+(page+1)):''}<small class="welcome-foot">第${page+1}頁，共${Math.ceil(children.length/6)}頁</small></div>`:''}`);syncContext();
}
function findPath(id,n=tree,path=[]){if(n.id===id)return path;for(const c of n.children||[]){const r=findPath(id,c,[...path,c]);if(r)return r;}return null;}
function related(id){const q=engine.byId(id);const matches=engine.faq.filter(x=>x.id!==id&&x.path.slice(0,2).join('/')===q.path.slice(0,2).join('/')).slice(0,5);if(!matches.length){showNode(tree.children.find(n=>n.label===q.path[0]).id);return;}bot('<p>你也可能想了解：</p><div class="candidates">'+matches.map(x=>`<button class="candidate" data-action="answer" data-value="${x.id}">${escape(questionLabel(x))}</button>`).join('')+'</div>');}
async function action(el){if(busy)return;const type=el.dataset.action,value=el.dataset.value;switch(type){case'node':showNode(value);break;case'answer':showAnswer(engine.byId(value));break;case'query':ask(value);break;case'category':showNode(tree.children.find(n=>n.label===value).id);break;case'page':{const [id,p]=value.split(':');showNode(id,false,Number(p));break;}case'home':home();break;case'contact':showContact();break;case'related':related(value);break;case'miss':state={};display(engine.search(''));home();break;case'copy':{const text='低碳永續家園詢問：\n'+(lastQuestion||'請補上你要詢問的問題');try{await navigator.clipboard.writeText(text);el.textContent='已複製問題';}catch{bot('<p>請複製以下文字：</p><div class="answer-text">'+escape(text)+'</div>');}break;}}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)action(b);});
$('composer').addEventListener('submit',e=>{e.preventDefault();if(busy)return;const text=$('question').value.trim();ask(text);$('question').value='';$('question').style.height='auto';});
$('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}});
$('question').addEventListener('input',()=>{$('question').style.height='auto';$('question').style.height=Math.min(110,$('question').scrollHeight)+'px';});
$('home-button').onclick=()=>home();$('contact-button').onclick=()=>showContact();
$('launcher').onclick=()=>{const open=$('widget').hidden;$('widget').hidden=!open;$('launcher').setAttribute('aria-expanded',String(open));if(open)$('question').focus();};$('close-widget').onclick=()=>{$('widget').hidden=true;$('launcher').setAttribute('aria-expanded','false');$('launcher').focus();};
$('clear-button').onclick=()=>{replyToken++;setBusy(false);chat.replaceChildren();state={};misses=0;lastQuestion='';home();};
$('back-button').onclick=()=>{if(navStack.length<2)return;navStack.pop();const id=navStack.at(-1);if(id===tree.id)home(false);else showNode(id,false);};
try{
 const responses=await Promise.all(['faq.json','tree.json','tests.json'].map(x=>fetch(x)));if(responses.some(r=>!r.ok))throw Error('data unavailable');
 const data=await Promise.all(responses.map(r=>r.json()));engine=createEngine(data[0]);tree=data[1];tests=data[2];
 home();
}catch(e){bot('<p>題庫暫時無法載入，請重新整理頁面，或至官方網站查詢。</p><a href="'+OFFICIAL+'" target="_blank" rel="noopener">前往官方網站 ↗</a>');$('composer').querySelector('button').disabled=true;}
