const STORAGE_KEY = "awaken_hunter_save_v1";
const XP_BY_QUEST = { walk: 30, gym: 100, meal: 20, screen: 50, focus: 25, dailyBonus: 100, weeklyWalk: 200, weeklyGym: 250 };
const QUEST_TEMPLATES = [
  {id:"walk", title:"TOUCH GRASS", desc:"Go for a walk for at least 20 minutes.", category:"Fitness", kind:"daily", xp:30, icon:"⌁", stat:"agility", cap:1},
  {id:"gym", title:"TRAIN TO IMPROVE", desc:"Complete a gym or strength-training session.", category:"Fitness", kind:"daily", xp:100, icon:"✣", stat:"strength", cap:1},
  {id:"meal", title:"FUEL THE HUNTER", desc:"Log a balanced meal or a positive nutrition habit.", category:"Nutrition", kind:"daily", xp:20, icon:"✧", stat:"vitality", cap:3},
  {id:"screen", title:"RESIST DISTRACTION", desc:"Meet your personal daily screen-time goal.", category:"Discipline", kind:"daily", xp:50, icon:"◉", stat:"discipline", cap:1},
  {id:"focus", title:"FOCUS PROTOCOL", desc:"Complete one uninterrupted focus session.", category:"Discipline", kind:"daily", xp:25, icon:"◷", stat:"discipline", cap:4},
  {id:"weeklyWalk", title:"WEEKLY EXPLORER", desc:"Log 5 walks this week.", category:"Fitness", kind:"weekly", xp:200, icon:"⌁", stat:"agility", target:5},
  {id:"weeklyGym", title:"WEEKLY TRAINING", desc:"Log 3 gym sessions this week.", category:"Fitness", kind:"weekly", xp:250, icon:"✣", stat:"strength", target:3}
];
const $ = id => document.getElementById(id);
const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const weekKey = (date=new Date()) => { const d=new Date(date); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); return localDate(d); };
const defaultState = () => ({
  name:"PLAYER", totalXP:0, streak:0, lastStreakDate:"", screenGoal:120, screenActual:0,
  completions:[], xpEvents:[], focusLog:[], createdAt:localDate(), lastOpened:localDate()
});
let state = loadState();
let activeFilter = "daily";
let focusMinutes = 25, focusSecondsLeft = 1500, focusTimer = null, focusRunning = false;
let toastTimer = null;

function loadState(){
  try { const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return defaultState(); const parsed=JSON.parse(raw); return {...defaultState(),...parsed}; }
  catch(e){ return defaultState(); }
}
function saveState(){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){showToast("Could not save data. Export a backup if possible.");} }
function today(){return localDate();}
function getCompletionsForDate(date=today()){return state.completions.filter(c=>c.date===date);}
function getQuestCompletions(id,date=today()){return state.completions.filter(c=>c.questId===id&&c.date===date);}
function isDone(id,date=today()){return getQuestCompletions(id,date).length>0;}
function levelFromXP(xp){
  let level=1, remaining=Math.max(0,xp), need=100;
  while(remaining>=need){remaining-=need;level++;need=100+(level-1)*25;if(level>10000)break;}
  return {level,into:remaining,need};
}
function rankFromLevel(level){if(level>=76)return"S";if(level>=51)return"A";if(level>=36)return"B";if(level>=21)return"C";if(level>=11)return"D";return"E";}
function getTodayXP(){return state.xpEvents.filter(e=>e.date===today()).reduce((s,e)=>s+e.xp,0);}
function getStat(stat){
  const relevant=state.completions.filter(c=>c.stat===stat).length;
  return 1+relevant;
}
function getWeeklyCount(id){
  const start=weekKey();
  return state.completions.filter(c=>c.questId===id&&c.date>=start&&c.date<=today()).length;
}
function questProgress(q){
  if(q.id==="weeklyWalk")return Math.min(q.target,getWeeklyCount("walk"));
  if(q.id==="weeklyGym")return Math.min(q.target,getWeeklyCount("gym"));
  return getQuestCompletions(q.id).length;
}
function questReady(q){
  if(q.kind==="weekly")return !state.completions.some(c=>c.questId===q.id&&c.week===weekKey());
  return getQuestCompletions(q.id).length < q.cap;
}
function claimQuest(id, opts={}){
  const q=QUEST_TEMPLATES.find(x=>x.id===id); if(!q)return;
  if(q.kind==="weekly" && questProgress(q)<q.target){showToast(`Complete the target first: ${questProgress(q)}/${q.target}.`);return;}
  if(q.id==="screen"){
    const actual=Number(state.screenActual), goal=Number(state.screenGoal);
    if(!Number.isFinite(actual)||actual<0||actual>1440||actual>goal){showToast("Screen-time goal not met yet. Update today's usage in Settings.");return;}
  }
  if(!questReady(q)){showToast("This quest has already been claimed for its current period.");return;}
  const date=today();
  const record={id:cryptoSafeId(),questId:q.id,date,week:weekKey(),xp:q.xp,stat:q.stat,category:q.category};
  state.completions.push(record);state.totalXP+=q.xp;state.xpEvents.push({id:record.id,date,xp:q.xp,questId:q.id});
  updateStreak(date);saveState();
  const before=levelFromXP(state.totalXP-q.xp).level, after=levelFromXP(state.totalXP).level;
  renderAll();
  showToast(`${q.title} COMPLETE  +${q.xp} XP`);
  if(after>before)showLevelModal(after,rankFromLevel(before),rankFromLevel(after));
}
function cryptoSafeId(){return `${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}
function updateStreak(date){
  if(state.lastStreakDate===date)return;
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  if(state.lastStreakDate===localDate(yesterday))state.streak+=1;
  else state.streak=1;
  state.lastStreakDate=date;
}
function dailyCompletedCount(){return QUEST_TEMPLATES.filter(q=>q.kind==="daily"&&q.id!=="focus").filter(q=>isDone(q.id)).length;}
function maybeDailyBonus(){
  const required=["walk","gym","meal","screen"];
  if(required.every(id=>isDone(id))&&!state.completions.some(c=>c.questId==="dailyBonus"&&c.date===today())){
    const record={id:cryptoSafeId(),questId:"dailyBonus",date:today(),week:weekKey(),xp:XP_BY_QUEST.dailyBonus,stat:null,category:"Bonus"};
    state.completions.push(record);state.totalXP+=record.xp;state.xpEvents.push({id:record.id,date:today(),xp:record.xp,questId:"dailyBonus"});saveState();showToast("DAILY BONUS UNLOCKED +100 XP");
  }
}
function renderAll(){renderHome();renderQuests();renderCharacter();renderFocusStats();updateSettingsFields();}
function renderHome(){
  const lv=levelFromXP(state.totalXP),rank=rankFromLevel(lv.level);
  $("todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short"}).toUpperCase();
  $("hunterName").textContent=state.name||"PLAYER";$("levelValue").textContent=lv.level;$("rankValue").textContent=rank;
  $("totalXP").textContent=`${state.totalXP.toLocaleString()} XP`;
  $("nextXPText").textContent=`${lv.need-lv.into} XP to next level`;
  $("xpFill").style.width=`${Math.min(100,lv.into/lv.need*100)}%`;
  $("currentXPText").textContent=`${lv.into} XP`; $("nextLevelText").textContent=`NEXT LEVEL: ${lv.need} XP`;
  $("strengthValue").textContent=getStat("strength");$("agilityValue").textContent=getStat("agility");$("vitalityValue").textContent=getStat("vitality");$("disciplineValue").textContent=getStat("discipline");
  $("todayXP").textContent=getTodayXP().toLocaleString();$("streakValue").textContent=state.streak;
  const qs=QUEST_TEMPLATES.filter(q=>q.kind==="daily"&&q.id!=="focus");
  const completed=qs.filter(q=>!questReady(q)).length;
  $("dailyProgressTag").textContent=`${completed} / ${qs.length} COMPLETE`;
  $("homeQuests").innerHTML=qs.map(q=>questCard(q,true)).join("");
}
function questCard(q,compact=false){
  const ready=questReady(q), done=!ready, progress=questProgress(q);
  let description=q.desc;
  if(q.kind==="weekly")description+=` Progress: ${progress}/${q.target}.`;
  if(q.id==="screen")description=`Stay at or below ${state.screenGoal} minutes of screen time. Log your usage in Settings.`;
  const button=done?`<button class="claim-button" disabled>✓ DONE</button>`:`<button class="claim-button" data-claim="${q.id}">${q.kind==="weekly"?"CLAIM":"COMPLETE"}</button>`;
  return `<article class="quest-card ${done?"completed":""}"><div class="quest-icon">${q.icon}</div><div class="quest-main"><div class="quest-title">${q.title}</div><div class="quest-desc">${description}</div><div class="quest-meta"><span class="xp-reward">✦ +${q.xp} XP</span><span class="quest-type">${q.category.toUpperCase()}</span></div></div>${button}</article>`;
}
function renderQuests(){
  const list=QUEST_TEMPLATES.filter(q=>activeFilter==="all"||(activeFilter==="daily"?q.kind==="daily":q.kind==="weekly"));
  const completed=list.filter(q=>!questReady(q)).length;
  $("questCount").textContent=`${completed} / ${list.length}`;
  $("questSummaryFill").style.width=`${list.length?completed/list.length*100:0}%`;
  $("allQuests").innerHTML=list.map(q=>questCard(q)).join("");
  document.querySelectorAll(".filter-tab").forEach(b=>b.classList.toggle("active",b.dataset.filter===activeFilter));
}
function renderCharacter(){
  const lv=levelFromXP(state.totalXP),rank=rankFromLevel(lv.level);
  $("profileName").textContent=state.name||"PLAYER";$("profileRank").textContent=`${rank}-RANK HUNTER`;$("profileLevel").textContent=lv.level;
  $("attributesList").innerHTML=[["STRENGTH","strength"],["AGILITY","agility"],["VITALITY","vitality"],["DISCIPLINE","discipline"]].map(([label,key])=>{let v=getStat(key);return `<div class="attribute-row"><span>${label}</span><div class="attribute-track"><div style="width:${Math.min(100,v/50*100)}%"></div></div><strong>${v}</strong></div>`}).join("");
  const total=state.completions.length, walks=state.completions.filter(c=>c.questId==="walk").length, workouts=state.completions.filter(c=>c.questId==="gym").length;
  $("recordXP").textContent=state.totalXP.toLocaleString();$("recordQuests").textContent=total;$("recordWalks").textContent=walks;$("recordWorkouts").textContent=workouts;
  const achievements=[
    ["✦","FIRST AWAKENING","Earn your first XP.",state.totalXP>0],
    ["⌁","STEP OUTSIDE","Log your first walk.",walks>0],
    ["✣","TRAINING BEGINS","Log your first workout.",workouts>0],
    ["◈","CONSISTENT HUNTER","Reach a 3-day streak.",state.streak>=3],
    ["◇","RANK UP","Reach D rank.",lv.level>=11],
    ["★","MILLENNIUM","Earn 1,000 total XP.",state.totalXP>=1000]
  ];
  $("achievements").innerHTML=achievements.map(a=>`<div class="achievement ${a[3]?"unlocked":""}"><span>${a[0]}</span><strong>${a[1]}</strong><small>${a[2]}</small></div>`).join("");
}
function updateSettingsFields(){
  if(document.activeElement!==$("nameInput"))$("nameInput").value=state.name;
  if(document.activeElement!==$("screenGoalInput"))$("screenGoalInput").value=state.screenGoal;
  if(document.activeElement!==$("screenActualInput"))$("screenActualInput").value=state.screenActual;
}
function renderFocusStats(){
  const sessions=state.focusLog.filter(x=>x.date===today()&&x.completed);
  $("focusSessions").textContent=sessions.length;
  $("focusMinutes").textContent=sessions.reduce((s,x)=>s+x.minutes,0);
}
function showToast(message){
  const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}
function showLevelModal(level,oldRank,newRank){
  $("levelModalTitle").textContent=oldRank!==newRank?`${newRank}-RANK AWAKENED`:"LEVEL UP";
  $("levelModalText").textContent=oldRank!==newRank?`Hunter level ${level} reached. Your rank has increased from ${oldRank} to ${newRank}. Keep progressing.`:`You reached hunter level ${level}. Your real-world consistency is adding up.`;
  $("levelModal").classList.remove("hidden");
}
function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  window.scrollTo({top:0,behavior:"smooth"});
}
function setFocusMinutes(minutes){
  if(focusRunning)return;
  focusMinutes=minutes;focusSecondsLeft=minutes*60;
  document.querySelectorAll(".preset").forEach(b=>b.classList.toggle("active",Number(b.dataset.minutes)===minutes));
  updateTimerDisplay();$("focusState").textContent="READY";
}
function updateTimerDisplay(){
  const mins=Math.floor(focusSecondsLeft/60),secs=focusSecondsLeft%60;
  $("timerDisplay").textContent=`${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}
function startFocus(){
  if(focusRunning){clearInterval(focusTimer);focusTimer=null;focusRunning=false;$("focusStart").textContent="▶ RESUME SESSION";$("focusState").textContent="PAUSED";return;}
  focusRunning=true;$("focusStart").textContent="Ⅱ PAUSE SESSION";$("focusState").textContent="IN PROGRESS";
  focusTimer=setInterval(()=>{
    focusSecondsLeft--;updateTimerDisplay();
    if(focusSecondsLeft<=0)finishFocus();
  },1000);
}
function finishFocus(){
  clearInterval(focusTimer);focusTimer=null;focusRunning=false;focusSecondsLeft=0;updateTimerDisplay();
  $("focusStart").textContent="▶ START SESSION";$("focusState").textContent="COMPLETE";
  state.focusLog.push({date:today(),minutes:focusMinutes,completed:true});
  const q=QUEST_TEMPLATES.find(x=>x.id==="focus");
  if(questReady(q)){
    const record={id:cryptoSafeId(),questId:"focus",date:today(),week:weekKey(),xp:q.xp,stat:q.stat,category:q.category};
    state.completions.push(record);state.totalXP+=q.xp;state.xpEvents.push({id:record.id,date:today(),xp:q.xp,questId:q.id});
  }
  saveState();renderAll();showToast(`FOCUS COMPLETE +${questReady(q)?0:q.xp} XP`);
}
function resetFocus(){clearInterval(focusTimer);focusTimer=null;focusRunning=false;focusSecondsLeft=focusMinutes*60;updateTimerDisplay();$("focusStart").textContent="▶ START SESSION";$("focusState").textContent="READY";}
function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`awaken-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);showToast("BACKUP EXPORTED");
}
function importBackup(file){
  const reader=new FileReader();
  reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(typeof parsed.totalXP!=="number"||!Array.isArray(parsed.completions))throw Error("Invalid backup");state={...defaultState(),...parsed};saveState();renderAll();showToast("BACKUP RESTORED");}catch(e){showToast("Invalid backup file.");}};
  reader.readAsText(file);
}
function resetAll(){
  if(!confirm("Reset all AWAKEN progress? This cannot be undone unless you exported a backup."))return;
  clearInterval(focusTimer);state=defaultState();saveState();resetFocus();renderAll();navigate("home");showToast("SYSTEM RESET");
}

document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-page]");if(nav){navigate(nav.dataset.page);return;}
  const go=e.target.closest("[data-go]");if(go){navigate(go.dataset.go);return;}
  const claim=e.target.closest("[data-claim]");if(claim){claimQuest(claim.dataset.claim);maybeDailyBonus();renderAll();return;}
  const filter=e.target.closest("[data-filter]");if(filter){activeFilter=filter.dataset.filter;renderQuests();return;}
  const preset=e.target.closest("[data-minutes]");if(preset){setFocusMinutes(Number(preset.dataset.minutes));return;}
});
$("settingsBtn").addEventListener("click",()=>navigate("settings"));
$("saveSettings").addEventListener("click",()=>{
  const name=$("nameInput").value.trim().slice(0,18)||"PLAYER";
  const goal=Number($("screenGoalInput").value),actual=Number($("screenActualInput").value);
  if(!Number.isFinite(goal)||goal<15||goal>1440||!Number.isFinite(actual)||actual<0||actual>1440){showToast("Enter a valid time between 0 and 1440 minutes; goal must be at least 15.");return;}
  state.name=name;state.screenGoal=goal;state.screenActual=actual;saveState();renderAll();showToast("SYSTEM SETTINGS SAVED");
});
$("focusStart").addEventListener("click",startFocus);
$("focusReset").addEventListener("click",resetFocus);
$("closeModal").addEventListener("click",()=>$("levelModal").classList.add("hidden"));
$("exportBtn").addEventListener("click",exportBackup);
$("importFile").addEventListener("change",e=>{if(e.target.files&&e.target.files[0])importBackup(e.target.files[0]);e.target.value="";});
$("resetBtn").addEventListener("click",resetAll);
window.addEventListener("beforeunload",saveState);

function handleDateChange(){
  const current=today();
  if(state.lastOpened!==current){state.lastOpened=current;state.screenActual=0;saveState();renderAll();}
}
handleDateChange();
renderAll();
if("serviceWorker" in navigator && location.protocol!=="file:"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}
