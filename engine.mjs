export const OFFICIAL='https://lcss.moenv.gov.tw/';
export const CONTACT=OFFICIAL+'LcssViewPage/ab/Contact.aspx';
export const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/台/g,'臺').replace(/銀牌/g,'銀級').replace(/銅牌/g,'銅級').replace(/帳戶/g,'帳號').replace(/[\s\p{P}\p{S}]/gu,'');
const grams=s=>{s=normalize(s);return new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));};
const ratio=(a,b)=>{let n=0;for(const x of a)if(b.has(x))n++;return n/Math.max(1,a.size);};
export function createEngine(faq){
 const index=faq.map(q=>({...q,qgrams:grams(q.question),allgrams:grams(q.question+' '+q.aliases.join(' ')+' '+q.answer)}));
 const byId=id=>faq.find(q=>q.id===id);
 const origin=id=>faq.find(q=>q.origins.includes('V2:'+id));
 function result(q){
  if(q.needsReview)return {type:'review',text:'這題的資料目前需要進一步確認，暫時不提供確定結論。你可以先查看官方說明，或聯絡客服協助。',items:[q]};
  return {type:q.kind.includes('導引')||q.kind==='原網站查詢'?'navigation':'answer',text:q.answer,items:[q]};
 }
 function threshold(level,grade){return faq.find(q=>q.question===level+'申請'+grade+'評等的門檻是什麼？');}
 function search(input,context={}){
  const text=normalize(input);let state={...context};
  if(!text)return {type:'empty',text:'請輸入你想了解的問題，或從下方常見主題開始。',state};
  if(text.length>500)return {type:'too-long',text:'問題比較長，請先保留一個重點，並告訴我是報名、認證條件、操作、案例或補助問題。',state};
  if(/轉人工|找人工|真人|聯絡客服|客服電話|人工客服|找客服/.test(text))return {type:'human',text:'你可以透過以下官方管道聯絡客服。這裡會提供聯絡方式，不會自動建立案件或安排真人接手。',state};
  if(/^(你好|您好|哈囉|嗨|hello|hi|謝謝|感謝)$/.test(text))return {type:'greeting',text:'你好！我可以協助查詢低碳家園認證、網站操作、行動項目、案例與補助資訊。想先了解哪一項？',state};
  const unrelated=()=>({type:'unrelated',text:'這個問題超出低碳永續家園公開資訊的服務範圍。我可以協助查詢認證制度、網站操作、六大面向與行動項目、評等現況、亮點案例、競賽、補助及低碳知識。請選擇主選單，或輸入相關問題。',state:{}});
  // Reject explicit outside topics before context, keyword routes or fuzzy matching.
  if(/遊戲|電玩|戰鬥陀螺|陀螺|股票|股價|選股|比特幣|加密貨幣|天氣|氣象預報|樂透|彩券|星座|算命|食譜|推薦.*餐廳|幫我.*寫程式/.test(text))return unrelated();
  const exactKnown=faq.some(q=>normalize(q.question)===text||q.aliases.some(a=>normalize(a)===text));
  const followup=!!context.pending&&/^(村里|鄉鎮市區|縣市政府|銅級|銀級)$/.test(text)||!!context.grade&&/^那(?:銅級|銀級|村里|鄉鎮市區|縣市政府)呢$/.test(text)||context.topic==='competition'&&/^那11[0-5]年呢?$/.test(text);
  const vague=/^(我要申請|怎麼申請|如何申請|申請|報名|怎麼弄|這個怎麼弄|怎麼辦|不會用|有問題|不知道)$/.test(text);
  const inScope=/低碳|永續|家園|淨零|減碳|減排|碳排|溫室氣體|認證|評等|銅級|銀級|綠色團隊|行動項目|六大面向|生態綠化|綠能節電|綠色運輸|資源循環|低碳生活|永續經營|綠屋頂|綠牆|植樹|區域綠化|節能|節水|太陽能|雨水|回收|廚餘|堆肥|魚菜共生|綠點|補助|競賽|獲獎|得獎|亮點|帳號|密碼|登入|登錄|網站|上傳|案件|村里|鄉鎮|縣市政府|里長|村長/.test(text);
  if(!exactKnown&&!followup&&!vague&&!inScope)return unrelated();
  // Carry context only for explicit short follow-ups; new topics start independently.
  if(!followup)state={};
  const level=/鄉鎮|鄉鎮市區|區公所/.test(text)?'鄉鎮市區':/縣市政府|縣政府|市政府/.test(text)?'縣市政府':/村里|里長|村長|我們里|我們村|我是里|我是村|村里層級/.test(text)?'村里':null;
  const grade=/銀級/.test(text)?'銀級':/銅級/.test(text)?'銅級':null;
  if(level)state.level=level;if(grade)state.grade=grade;
  const explicitYear=text.match(/(?:^|[^\d])(10[9]|11[0-5])年/);if(explicitYear)state.year=explicitYear[1];
  if(/競賽|獲獎|得獎/.test(text))state.topic='competition';
  if(context.pending&&/^(村里|鄉鎮市區|縣市政府|銅級|銀級)$/.test(text))return search(context.pending+' '+input,{...state,pending:null});
  const hasGrade=!!grade||(/那.*呢|條件|門檻|幾項|幾個項目/.test(text)&&!!state.grade);
  const wantsThreshold=hasGrade&&!/案例|補助|書面|現勘|評分比重|委員/.test(text)&&(/條件|門檻|申請|幾項|幾個|那.*呢|怎麼拿|怎麼取得/.test(text));
  const multiple=(hasGrade&&/密碼|帳號/.test(text))||(/補助/.test(text)&&hasGrade);
  if(multiple)return {type:'multiple',text:'你提到了不同的需求，想先處理哪一項？',choices:[{label:'認證條件',query:(state.level||'')+'申請'+(state.grade||'銀級')+'的條件'},{label:/密碼|帳號/.test(text)?'帳號與密碼':'補助資訊',query:/密碼|帳號/.test(text)?'若忘記系統密碼該如何處理？':'有哪些最新補助可以申請？'}],state};
  if(state.level&&!state.grade&&/認證|申請/.test(text)&&/條件|門檻/.test(text))return {type:'clarify',field:'grade',text:'你想申請銅級還是銀級？',choices:['銅級','銀級'].map(label=>({label,query:label})),state:{...state,pending:input}};
  if(wantsThreshold){
   if(!state.level)return {type:'clarify',field:'level',text:'不同申請層級的門檻不同。你想查哪個層級？',choices:['村里','鄉鎮市區','縣市政府'].map(label=>({label,query:label})),state:{...state,pending:input}};
   if(!state.grade)return {type:'clarify',field:'grade',text:'你想申請銅級還是銀級？',choices:['銅級','銀級'].map(label=>({label,query:label})),state:{...state,pending:input}};
   const q=threshold(state.level,state.grade);if(q)return {...result(q),state:{...state,pending:null}};
  }
  if(/我的|我送出|我們的/.test(text)&&/進度|案件/.test(text))return {type:'private',text:'這裡無法讀取個人或申請單位的案件資料。請使用原網站的進度查詢或登入功能；若仍有問題，可以聯絡官方客服。',url:OFFICIAL+'LcssViewPage/ab/EvalABMain.aspx',state};
  if(/115年/.test(text)&&(/競賽|獲獎|得獎/.test(text)||(state.topic==='competition'&&/那|改成|換成/.test(text))))return {type:'missing',text:'目前收錄的附件尚未包含115年度競賽辦法與獲獎名單，因此不套用113年的規則。請查看官方最新公告，或聯絡客服確認。',url:OFFICIAL+'LcssViewPage/ab/villages/activity-detail3.aspx',state};
  const exact=faq.find(q=>normalize(q.question)===text||q.aliases.some(a=>normalize(a)===text));if(exact)return {...result(exact),state};
  if(/綠色團隊/.test(text)&&/幾|人數|至少/.test(text))return {...result(origin('faq_007')),state};
  if(/忘記|遺失|忘了|不記得/.test(text)&&/密碼/.test(text))return {...result(origin('faq_040')),state};
  if(/五年|5年|有效期|有效期限/.test(text)&&/銀級|評等|認證/.test(text))return {...result(origin('faq_276')),state};
  if(/最新|現在|目前|今天/.test(text)&&/補助/.test(text))return {...result(faq.find(q=>q.question==='有哪些最新補助可以申請？')),state};
  if(/現在|目前|最新|多少|幾個/.test(text)&&/全國|全臺|縣市|新北|臺北/.test(text)&&/銀級|銅級|評等|通過/.test(text))return {...result(faq.find(q=>q.question==='如何查詢全國評等成果？')),state};
  if(/^(我要申請|怎麼申請|如何申請|申請|報名|怎麼弄|這個怎麼弄|怎麼辦|不會用|有問題|不知道)$/.test(text))return {type:'clarify',text:'你想處理哪一件事？選一下，我再帶你往下找。',choices:[{label:'認證申請條件',query:'申請銀級的條件'},{label:'線上報名流程',query:'申請評等前需要完成什麼報名程序？'},{label:'網站操作問題',category:'網站操作'}],state:{...state,pending:null}};
  const g=grams(input);const domain=/補助/.test(text)?'補助資訊':/密碼|帳號|登入|上傳/.test(text)?'網站操作':/競賽|獲獎|得獎/.test(text)?'多元競賽':/認證|銅級|銀級|評等門檻/.test(text)?'認證制度':null;const pool=domain?index.filter(q=>q.path[0]===domain):index;
  const scored=pool.map(q=>{const query=ratio(g,q.qgrams),extra=ratio(g,q.allgrams),precision=ratio(q.qgrams,g);return {q,score:query*.68+extra*.22+precision*.1,query};}).sort((a,b)=>b.score-a.score);
  const top=scored[0];
  if(top&&top.score>=.76&&top.query>=.65&&(!scored[1]||top.score-scored[1].score>=.12))return {...result(top.q),state};
  const relevant=scored.filter(x=>x.score>=.24&&x.query>=.12).slice(0,3).map(x=>x.q);
  if(!relevant.length&&domain==='補助資訊'){const guide=faq.find(q=>q.question==='有哪些最新補助可以申請？');if(guide)relevant.push(guide);}
  if(relevant.length)return {type:'candidates',text:'我找到幾個可能相關的問題。你想了解哪一項？',items:relevant,state};
  return {type:'no-match',text:'目前題庫沒有找到對應的答案。你可以換一個說法、從主題選單查找，或聯絡客服。',state};
 }
 return {search,byId,result,faq};
}
