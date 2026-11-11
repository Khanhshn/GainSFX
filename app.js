/* GainSFX v1.3 — frontend + optional Supabase Auth / Storage. */
(() => {
'use strict';
const ICONS = {
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-2.3 5.7L7 17l2.3-5.7L15 9Z"/>',heart:'<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',audio:'<path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/>',upload:'<path d="M12 16V3m-4 4 4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/>','arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>','arrow-right':'<path d="M4 12h16m-7-7 7 7-7 7"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',sliders:'<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',play:'<path d="m8 5 11 7-11 7V5Z"/>',pause:'<path d="M8 5v14M16 5v14"/>','skip-back':'<path d="M6 5v14m12-14L7 12l11 7V5Z"/>','skip-forward':'<path d="M18 5v14M6 5l11 7-11 7V5Z"/>',volume:'<path d="m11 5-5 4H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',sparkles:'<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Zm6 12 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z"/>',zap:'<path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>','more-horizontal':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3"/><circle cx="12" cy="12" r="3"/>','upload-cloud':'<path d="M20 16.6A5 5 0 0 0 17 7h-1.1a7 7 0 0 0-13.4 2A5 5 0 0 0 5 19h3m4 2V11m-4 4 4-4 4 4"/>',square:'<rect x="5" y="5" width="14" height="14" rx="2"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.audio}</svg>`;
function injectIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=svg(el.dataset.icon)});}
const $ = id => document.getElementById(id);
const removeAccents = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const escapeHtml = v => String(v??'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const formatTime = s => `${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
const CATS=['Tất cả','Thiên nhiên','Động vật','Con người','Phương tiện','Vật dụng','Hiệu ứng'];
const CAT_EMOJI={'Tất cả':'✨','Thiên nhiên':'🍃','Động vật':'🐾','Con người':'👣','Phương tiện':'🚗','Vật dụng':'🔔','Hiệu ứng':'⚡'};
const sounds = [...(window.GAIN_SOUNDS||[])];
const cloud = window.GainCloud;
let authMode = 'signin';
let cloudQueryVersion = 0;
const soundById = id => sounds.find(s=>s.id===id);
const audio=$('audioElement');
const state={view:'discover',category:'Tất cả',query:'',sort:'recommended',selected:sounds[0]?.id||null,similarScores:null,playing:false,uploadCount:0};
let favorites=new Set();
try{favorites=new Set(JSON.parse(localStorage.getItem('gainSFX_favorites')||'[]'));}catch(_e){}
const featureCache=new Map();let context=null;let recorder=null;let recordStream=null;let recordChunks=[];let recordTimer=null;let recordStartTime=0;let stopRequested=false;
function toast(msg,type='info'){
  const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;$('toastArea').appendChild(el);
  setTimeout(()=>el.remove(),4500);
}
function categoryMarkup(cat, sidebar=false){return `<button type="button" ${sidebar?'data-category-sidebar':'data-category'}="${escapeHtml(cat)}" class="${state.category===cat?'active selected':''}">${sidebar?`<span class="cat-emoji">${CAT_EMOJI[cat]}</span>`:''}${escapeHtml(cat)}</button>`;}
function renderCategories(){ $('sidebarCategories').innerHTML=CATS.slice(1).map(c=>categoryMarkup(c,true)).join(''); $('filterChips').innerHTML=CATS.map(c=>categoryMarkup(c,false)).join(''); }
function renderNavigation(){document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===state.view));$('favCount').textContent=favorites.size;}
function readMatches(s){let hay=removeAccents([s.name,s.description,s.category,...(s.tags||[])].join(' '));return removeAccents(state.query).split(/\s+/).every(term=>!term||hay.includes(term));}
function filteredSounds(){let arr=sounds.filter(s=>{
  if(state.view==='favorites'&&!favorites.has(s.id))return false;
  if(state.view==='uploads'&&(!s.uploaded || (s.cloud && s.owner_id!==cloud.user?.id)))return false;
  if(state.category!=='Tất cả'&&state.category!==s.category)return false;
  return readMatches(s);
});
  if(state.similarScores)arr.sort((a,b)=>(state.similarScores[a.id]??999)-(state.similarScores[b.id]??999));
  else if(state.sort==='name')arr.sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  else if(state.sort==='short')arr.sort((a,b)=>a.duration-b.duration);
  else if(state.sort==='long')arr.sort((a,b)=>b.duration-a.duration);
  else if(state.sort==='newest')arr.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return arr;
}
function miniBars(seed,n=17){let out='';let h=0;for(let i=0;i<n;i++){h=Math.abs(Math.sin((i+1)*12.353+seed*3.232)*Math.cos(i*.83+seed));out+=`<i style="height:${6+Math.round(h*27)}px"></i>`;}return out;}
function cardHTML(s){const playing=state.selected===s.id&&!audio.paused;const sel=state.selected===s.id;const fav=favorites.has(s.id);
  return `<article class="sound-card ${sel?'selected':''}" data-sound="${escapeHtml(s.id)}">
  <div class="sound-art" style="--c1:${s.colors?.[0]||'#443f83'};--c2:${s.colors?.[1]||'#192c4c'}"><div class="art-emoji">${s.emoji||'🎵'}</div><span class="art-top-tag">${s.cloud?(s.visibility==='private'?'🔒 RIÊNG TƯ':'🌍 CÔNG KHAI'):(s.uploaded?'TỆP TẠM THỜI':'SOUND EFFECT')}</span><span class="art-wave">${miniBars(s.id.length)}</span></div>
  <div class="sound-info"><h3 title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</h3><div class="sound-meta"><span class="tag-pill">${escapeHtml(s.category)}</span><span class="time-tag">${formatTime(s.duration)}</span></div><div class="sound-actions"><button class="play-card ${playing?'playing':''}" data-action="play" data-id="${escapeHtml(s.id)}" aria-label="Nghe thử ${escapeHtml(s.name)}">${svg(playing?'pause':'play')}</button><span class="preview-label">${playing?'Đang phát':'Nghe thử'}</span><button class="card-icon ${fav?'active':''}" data-action="favorite" data-id="${escapeHtml(s.id)}" aria-label="Yêu thích ${escapeHtml(s.name)}">${svg('heart')}</button><button class="card-icon" data-action="detail" data-id="${escapeHtml(s.id)}" aria-label="Xem chi tiết ${escapeHtml(s.name)}">${svg('more-horizontal')}</button><button class="card-icon" data-action="download" data-id="${escapeHtml(s.id)}" aria-label="Tải xuống ${escapeHtml(s.name)}">${svg('download')}</button>${s.cloud&&(s.owner_id===cloud.user?.id||cloud.role==='admin'&&s.visibility==='public')?`<button class="card-icon" data-action="delete-cloud" data-id="${escapeHtml(s.id)}" title="Xóa âm thanh" aria-label="Xóa âm thanh ${escapeHtml(s.name)}">${svg('x')}</button>`:''}</div></div></article>`;
}
function updateLibrary(){const list=filteredSounds();$('soundGrid').innerHTML=list.map(cardHTML).join('');
  $('emptyState').hidden=Boolean(list.length);$('resultsCount').textContent=list.length;
  $('gridMeta').textContent=`Hiển thị ${list.length} / ${sounds.length} âm thanh`;$('gridMetaRight').textContent=`${String(list.length).padStart(2,'0')} KẾT QUẢ`;
  let title='Khám phá âm thanh',sub='Tìm giai điệu của thế giới qua từng âm thanh nhỏ.';
  if(state.view==='favorites'){title='Âm thanh yêu thích';sub='Những âm thanh bạn đã lưu lại.'}
  if(state.view==='uploads'){title='Tệp âm thanh của tôi';sub='Các Sound Effect bạn đã tải lên trong tài khoản.'}
  if(state.similarScores){title='Kết quả âm thanh tương tự';sub='Các kết quả được xếp hạng theo đặc trưng tín hiệu.'}
  if(state.query){title='Kết quả tìm kiếm';sub=`Kết quả cho “${state.query.slice(0,90)}”`;}
  $('libraryTitle').innerHTML=`${escapeHtml(title)} <span class="count-pill" id="resultsCount">${list.length}</span>`;
  $('librarySubtitle').textContent=sub;
  $('clearFilters').hidden=(state.category==='Tất cả'&&!state.query&&!state.similarScores&&state.view==='discover');
  $('similarityBanner').hidden=!state.similarScores;
  renderCategories();renderNavigation();$('statCount').textContent=sounds.length;$('heroCount').textContent=sounds.length;
}
function setView(view){state.view=view;state.category='Tất cả';state.query='';state.similarScores=null;$('searchInput').value='';$('sortSelect').value='recommended';state.sort='recommended';updateLibrary();$('pageScroll').scrollTo({top:0,behavior:'smooth'});document.querySelector('.sidebar').classList.remove('open');}
function chooseCategory(cat){state.category=cat;state.view='discover';updateLibrary();$('soundsSection').scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('.sidebar').classList.remove('open');}
function clearFilters(){state.view='discover';state.category='Tất cả';state.query='';state.sort='recommended';state.similarScores=null;$('sortSelect').value='recommended';$('searchInput').value='';updateLibrary();}
function getSrc(s){return s?.src||s?.file||'';}
function selectSound(id,autoPlay=false){const s=soundById(id);if(!s)return;
  const changed=state.selected!==s.id;
  if(changed){state.selected=s.id;audio.pause();audio.src=getSrc(s);audio.load();}
  paintDetail();paintPlayer();updateLibrary();if(autoPlay)togglePlay(true);
}
async function togglePlay(forcePlay=false){const s=soundById(state.selected);if(!s){toast('Hãy chọn một âm thanh trước.');return;}
  if(!audio.src){audio.src=getSrc(s);audio.load();}
  if(!forcePlay&&!audio.paused){audio.pause();updatePlayIcons();return;}
  try{await audio.play();}catch(err){toast('Không thể phát tệp âm thanh. Hãy chạy website bằng localhost.', 'error');}
  updatePlayIcons();
}
function updatePlayIcons(){const play=!audio.paused&&!audio.ended;state.playing=play;$('mainPlayIcon').innerHTML=svg(play?'pause':'play');$('mainPlayIcon').parentElement.classList.toggle('playing',play);
  document.querySelectorAll('.play-card').forEach(btn=>{const active=play&&btn.dataset.id===state.selected;btn.classList.toggle('playing',active);btn.innerHTML=svg(active?'pause':'play');const label=btn.nextElementSibling;if(label)label.textContent=active?'Đang phát':'Nghe thử';});
}
function paintPlayer(){const s=soundById(state.selected);if(!s)return;
  $('playerTitle').textContent=s.name;$('playerSubtitle').textContent=s.category+' · '+formatTime(s.duration);$('playerCover').textContent=s.emoji||'🎵';
  $('playerCover').style.background=`linear-gradient(125deg,${s.colors?.[0]||'#5360a4'},${s.colors?.[1]||'#20304a'})`;
  $('totalTime').textContent=formatTime(audio.duration||s.duration);document.querySelectorAll('.player-favorite').forEach(el=>el.classList.toggle('active',favorites.has(s.id)));updatePlayIcons();
}
function drawWaveform(samples=null){const canvas=$('detailWave');if(!canvas)return;const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);const bars=70;const s=soundById(state.selected);let seed=(s?.id||'sound').split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  const gradient=ctx.createLinearGradient(0,0,W,0);gradient.addColorStop(0,'#5681eb');gradient.addColorStop(.5,'#b78cff');gradient.addColorStop(1,'#5ed6ef');ctx.fillStyle=gradient;
  for(let i=0;i<bars;i++){let v=.25+.55*Math.abs(Math.sin(i*.67+seed)+.45*Math.cos(i*1.19+seed));if(samples){const start=Math.floor(i*samples.length/bars),end=Math.floor((i+1)*samples.length/bars);let peak=0;for(let j=start;j<end;j+=Math.max(1,Math.floor((end-start)/48)))peak=Math.max(peak,Math.abs(samples[j]||0));v=Math.max(.09,Math.min(1,peak*1.35));} const h=7+v*84;const x=4+i*(W-8)/bars;ctx.fillRect(x,(H-h)/2,3.6,h);}
  ctx.strokeStyle='#4c5a92';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
}
function paintDetail(){const s=soundById(state.selected);if(!s)return;
  $('detailIcon').textContent=s.emoji||'🎵';$('detailTitle').textContent=s.name;$('detailCategory').textContent=s.category;$('detailDescription').textContent=s.description;$('detailFormat').textContent=s.uploaded?(String(s.fileName||'AUDIO').split('.').pop().toUpperCase()||'AUDIO'):'MP3';$('detailDuration').textContent=formatTime(s.duration);$('detailLicense').textContent=s.cloud?(s.visibility==='private'?'Riêng tư':'Công khai'):(s.uploaded?'Tạm thời':'Demo');
  document.querySelector('.detail-fav').classList.toggle('active',favorites.has(s.id));
  $('detailTags').innerHTML=(s.tags||[]).slice(0,5).map(t=>`<button type="button" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('');
  const related=sounds.filter(other=>other.id!==s.id&&other.category===s.category).slice(0,3);
  $('relatedList').innerHTML=(related.length?related:sounds.filter(other=>other.id!==s.id).slice(0,3)).map(other=>`<button class="related-item" data-action="detail" data-id="${escapeHtml(other.id)}"><span class="related-emoji">${other.emoji||'🎵'}</span><span class="related-copy"><strong>${escapeHtml(other.name)}</strong><small>${escapeHtml(other.category)} · ${formatTime(other.duration)}</small></span>${svg('play')}</button>`).join('');drawWaveform();
  fetchRealWave(s).catch(()=>{});
}
async function fetchRealWave(s){let samples=null;
  if(s.uploaded&&s.originalBuffer){samples=s.originalBuffer.getChannelData(0);}
  else if(!s.uploaded){const ab=await decodeSound(s);samples=ab.getChannelData(0);}
  if(state.selected===s.id&&samples)drawWaveform(samples);
}
function toggleFavorite(id){if(!id)return;if(favorites.has(id))favorites.delete(id);else favorites.add(id);try{localStorage.setItem('gainSFX_favorites',JSON.stringify([...favorites]));}catch(_e){}
  updateLibrary();paintDetail();paintPlayer();}
async function downloadSound(id){let s=soundById(id||state.selected);if(!s){toast('Chọn âm thanh cần tải trước.');return;}
  try {
    let url=getSrc(s), disposable=false;
    if(s.cloud){const blob=await cloud.getFileBlob(s);url=URL.createObjectURL(blob);disposable=true;}
    const a=document.createElement('a');a.href=url;a.download=s.uploaded?s.fileName:`GainSFX_${s.id}.mp3`;document.body.appendChild(a);a.click();a.remove();
    if(disposable)setTimeout(()=>URL.revokeObjectURL(url),10000);
    toast('Đã gửi yêu cầu tải “'+s.name+'”.','success');
  }catch(err){toast('Không thể tải âm thanh: '+(err.message||err),'error');}
}
function playRelated(idx){const visible=filteredSounds();const pos=visible.findIndex(s=>s.id===state.selected);const next=visible[(pos+idx+visible.length)%visible.length];if(next)selectSound(next.id,true);}
function openModal(tab='micro'){$('microModal').hidden=false;document.body.style.overflow='hidden';switchTab(tab);}
function switchTab(tab){document.querySelectorAll('.modal-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));$('micTab').hidden=tab!=='micro';$('fileTab').hidden=tab!=='file';}
function closeModal(){if(recorder&&recorder.state!=='inactive'){stopRecording();}
  $('microModal').hidden=true;document.body.style.overflow='';}
function updateMicClock(){let t=Math.floor((performance.now()-recordStartTime)/1000);$('micTime').textContent=formatTime(t);if(t>=12)stopRecording();}
async function startRecording(){if(!navigator.mediaDevices?.getUserMedia){toast('Micro chỉ được phép trên HTTPS hoặc localhost. Hãy chạy bằng Live Server.', 'error');return;}
 if(!window.MediaRecorder){toast('Trình duyệt này chưa hỗ trợ ghi âm qua MediaRecorder.','error');return;}
 try{recordStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'';
   recorder=mime?new MediaRecorder(recordStream,{mimeType:mime}):new MediaRecorder(recordStream);
   recordChunks=[];stopRequested=false;recorder.ondataavailable=e=>{if(e.data?.size)recordChunks.push(e.data)};
   recorder.onerror=()=>toast('Đã xảy ra lỗi trong lúc ghi âm.','error');
   recorder.onstop=async()=>{recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;clearInterval(recordTimer);$('micTab').querySelector('.mic-viz').classList.remove('recording');$('recordStart').hidden=false;$('recordStop').hidden=true;
     if(stopRequested){try{let blob=new Blob(recordChunks,{type:recorder.mimeType||'audio/webm'});if(blob.size<1000)throw Error('Bản ghi quá ngắn');$('micStatus').textContent='Đang phân tích và so khớp với thư viện...';await compareAudioBlob(blob);$('micStatus').textContent='Đã hoàn thành so khớp âm thanh.';}catch(err){$('micStatus').textContent='Không thể phân tích bản ghi.';toast('Không thể giải mã bản ghi micro: '+(err.message||err),'error');}}
   };
   recorder.start();recordStartTime=performance.now();updateMicClock();recordTimer=setInterval(updateMicClock,200);$('recordStart').hidden=true;$('recordStop').hidden=false;$('micTab').querySelector('.mic-viz').classList.add('recording');$('micStatus').textContent='Đang thu âm... Phát âm thanh bạn muốn tìm gần micro.';
 }catch(err){toast(err.name==='NotAllowedError'?'Bạn chưa cho phép truy cập micro.':'Không thể mở micro: '+(err.message||err),'error');}
}
function stopRecording(){if(recorder&&recorder.state!=='inactive'){stopRequested=true;recorder.stop();$('micStatus').textContent='Đang xử lý bản thu...';}}
function audioContext(){if(!context)context=new (window.AudioContext||window.webkitAudioContext)();return context;}
async function decodeBlob(blob){const bytes=await blob.arrayBuffer();return await audioContext().decodeAudioData(bytes.slice(0));}
const decodedCache=new Map();
async function decodeSound(s){if(s.originalBuffer)return s.originalBuffer;if(decodedCache.has(s.id))return decodedCache.get(s.id);let res=await fetch(getSrc(s));if(!res.ok)throw Error('Không tải được tệp '+s.name);const bytes=await res.arrayBuffer();const buf=await audioContext().decodeAudioData(bytes.slice(0));decodedCache.set(s.id,buf);return buf;}
// FFT radix-2 tu viet, tuong thich voi WAV/MP3/micro tu trinh duyet.
function fftMagnitude(input){const n=input.length;let re=new Float64Array(input),im=new Float64Array(n);
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let x=re[i];re[i]=re[j];re[j]=x;}}
  for(let len=2;len<=n;len<<=1){let ang=-2*Math.PI/len,wr0=Math.cos(ang),wi0=Math.sin(ang);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){let u=i+j,v=u+len/2,vr=re[v]*wr-im[v]*wi,vi=re[v]*wi+im[v]*wr;re[v]=re[u]-vr;im[v]=im[u]-vi;re[u]+=vr;im[u]+=vi;let w=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=w;}}}
  let mag=new Float64Array(n/2);for(let i=0;i<mag.length;i++)mag[i]=Math.hypot(re[i],im[i]);return mag;
}
function audioFeatures(buffer){const ch=buffer.getChannelData(0);let sr=buffer.sampleRate;const N=1024,F=17;let bands=new Float64Array(10);let rmsArr=[],zcr=0,centroid=0;
  const edges=[0,125,250,500,850,1350,2200,3500,5500,8500,16000];
  for(let f=0;f<F;f++){
    const position=Math.floor((f+.5)/F*Math.max(0,ch.length-N));const frame=new Float64Array(N);let energy=0,cross=0;
    for(let i=0;i<N;i++){const y=ch[position+i]||0;frame[i]=y*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));energy+=y*y;if(i>0&&(ch[position+i-1]||0)*y<0)cross++;}
    rmsArr.push(Math.sqrt(energy/N));zcr+=cross/N;
    let magnitudes=fftMagnitude(frame),ms=0,mcent=0;
    for(let k=1;k<magnitudes.length;k++){const hz=k*sr/N,m=magnitudes[k];let bi=edges.findIndex((b,i)=>i<edges.length-1&&hz>=b&&hz<edges[i+1]);if(bi>=0)bands[bi]+=m;ms+=m;mcent+=hz*m;}
    centroid+=ms>0?mcent/ms:0;
  }
  let sum=bands.reduce((a,b)=>a+b,0)||1;const logbands=Array.from(bands,v=>v/sum);
  const mean=rmsArr.reduce((a,b)=>a+b,0)/F,variance=Math.sqrt(rmsArr.reduce((a,v)=>a+(v-mean)**2,0)/F);
  return {bands:logbands,rms:Math.min(1,mean*4),rmsVariance:Math.min(1,variance*4),zcr:zcr/F,centroid:centroid/F/(sr/2),duration:buffer.duration};
}
function featureDistance(a,b){let dist=0;for(let i=0;i<10;i++){dist+=Math.abs(a.bands[i]-b.bands[i])*2.5;}dist+=.48*Math.abs(a.centroid-b.centroid)+.35*Math.abs(a.rmsVariance-b.rmsVariance)+.30*Math.abs(a.zcr-b.zcr)+.12*Math.abs(a.rms-b.rms);return dist;}
async function compareAudioBlob(blob){if(blob.size>20*1024*1024)throw Error('Tệp vượt quá 20 MB');const buffer=await decodeBlob(blob);if(buffer.duration<.25)throw Error('Bản ghi quá ngắn');
  const target=audioFeatures(buffer);const scores={};let failed=0;
  for(const s of sounds){try{let ft=featureCache.get(s.id);if(!ft){const b=await decodeSound(s);ft=audioFeatures(b);featureCache.set(s.id,ft);}scores[s.id]=featureDistance(target,ft);}catch(err){scores[s.id]=999;failed++;}}
  if(failed===sounds.length)throw Error('Không đọc được thư viện âm thanh. Hãy mở trang qua localhost.');
  state.similarScores=scores;state.query='';state.category='Tất cả';state.view='discover';state.sort='recommended';$('searchInput').value='';$('sortSelect').value='recommended';
  updateLibrary();$('microModal').hidden=true;document.body.style.overflow='';$('soundsSection').scrollIntoView({behavior:'smooth'});toast('Đã xếp hạng '+(sounds.length-failed)+' âm thanh theo độ tương đồng.','success');
}
async function compareFile(file){if(!file)return;try{if(file.size>20*1024*1024)throw Error('Tệp vượt quá 20 MB');toast('Đang phân tích tệp âm thanh...');await compareAudioBlob(file);}catch(err){toast('Không thể so khớp: '+(err.message||err),'error');}finally{$('compareFile').value='';}}
async function addUploads(files){let accepted=0;for(const file of files){if(!file.type.startsWith('audio/')&& !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)){toast('Không hỗ trợ: '+file.name,'error');continue;}
  if(file.size>20*1024*1024){toast('Tệp quá 20 MB: '+file.name,'error');continue;}
  try{let buf=await decodeBlob(file);const id='upload-'+Date.now()+'-'+(++state.uploadCount);const src=URL.createObjectURL(file);let name=file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
    const s={id,name:name||'Tệp âm thanh của tôi',category:'Vật dụng',emoji:'🎧',description:'Âm thanh cá nhân được thêm từ thiết bị của bạn.',tags:['âm thanh của tôi','tệp tải lên'],duration:buf.duration,fileName:file.name,src,colors:['#8264cc','#243c6f'],uploaded:true,originalBuffer:buf,date:'2026-11-04'};
    sounds.unshift(s);featureCache.set(id,audioFeatures(buf));accepted++;
  }catch(err){toast('Không thể đọc '+file.name+': '+(err.message||err),'error');}}
  if(accepted){setView('uploads');toast('Đã thêm '+accepted+' tệp vào thư viện tạm thời.','success');}
  $('importFile').value='';
}
function onAction(button){const action=button.dataset.action;const id=button.dataset.id;
  if(action==='play'){if(state.selected===id){togglePlay();}else selectSound(id,true);}
  else if(action==='favorite')toggleFavorite(id);
  else if(action==='favorite-current')toggleFavorite(state.selected);
  else if(action==='detail'){selectSound(id,false);if(window.matchMedia('(max-width:680px)').matches)$('detailPanel').scrollIntoView({behavior:'smooth',block:'start'});}
  else if(action==='download')downloadSound(id);
  else if(action==='download-current')downloadSound(state.selected);
  else if(action==='micro')openModal('micro');
  else if(action==='similar')openModal('file');
  else if(action==='import' || action==='open-upload')openUploadDialog();
  else if(action==='account')openAccountDialog();
  else if(action==='google-login')handleGoogleLogin();
  else if(action==='close-account')closeDialog('accountModal');
  else if(action==='close-upload')closeDialog('cloudUploadModal');
  else if(action==='close-admin')closeDialog('adminModal');
  else if(action==='logout')handleLogout();
  else if(action==='admin-panel')openAdminDialog();
  else if(action==='delete-cloud')handleDeleteCloud(id);
  else if(action==='close-modal')closeModal();
  else if(action==='start-record')startRecording();
  else if(action==='stop-record')stopRecording();
  else if(action==='clear-filters')clearFilters();
  else if(action==='clear-similar'){state.similarScores=null;updateLibrary();}
  else if(action==='player-toggle')togglePlay();
  else if(action==='prev')playRelated(-1);
  else if(action==='next')playRelated(1);
  else if(action==='scroll-sounds')$('soundsSection').scrollIntoView({behavior:'smooth'});
}
function addEvents(){document.addEventListener('click',e=>{
   const authTab=e.target.closest('[data-auth-mode]');if(authTab){setAuthMode(authTab.dataset.authMode);return;}
   const tab=e.target.closest('[data-tab]');if(tab){switchTab(tab.dataset.tab);return;}
   const cat=e.target.closest('[data-category]');if(cat){chooseCategory(cat.dataset.category);return;}
   const scat=e.target.closest('[data-category-sidebar]');if(scat){chooseCategory(scat.dataset.categorySidebar);return;}
   const tag=e.target.closest('[data-tag]');if(tag){state.view='discover';state.category='Tất cả';state.similarScores=null;state.query=tag.dataset.tag;$('searchInput').value=state.query;updateLibrary();$('soundsSection').scrollIntoView({behavior:'smooth'});return;}
   const view=e.target.closest('[data-view]');if(view){setView(view.dataset.view);return;}
   const act=e.target.closest('[data-action]');if(act){onAction(act);return;}
 });
 $('mobileMenu').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
 $('microModal').addEventListener('click',e=>{if(e.target===$('microModal'))closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('microModal').hidden)closeModal();});
 $('searchForm').addEventListener('submit',e=>{e.preventDefault();state.query=$('searchInput').value.trim();state.category='Tất cả';state.view='discover';state.similarScores=null;updateLibrary();$('soundsSection').scrollIntoView({behavior:'smooth'});});
 $('searchInput').addEventListener('input',e=>{state.query=e.target.value.trim();state.view='discover';state.similarScores=null;updateLibrary();});
 $('sortSelect').addEventListener('change',e=>{state.sort=e.target.value;if(state.similarScores)state.similarScores=null;updateLibrary();});
 $('volumeRange').addEventListener('input',e=>{audio.volume=Number(e.target.value)/100;e.target.style.setProperty('--range-progress',e.target.value+'%');});
 $('progressRange').addEventListener('input',e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Number(e.target.value)/100*audio.duration;});
 $('authForm').addEventListener('submit',handleAuthForm);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloud.enabled)refreshCloudSounds();});
   $('cloudUploadForm').addEventListener('submit',handleUploadForm);
   $('cloudFile').addEventListener('change',e=>{const file=e.target.files[0];if(file)$('cloudTitle').value=file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');});
   for(const id of ['accountModal','cloudUploadModal','adminModal'])$(id).addEventListener('click',e=>{if(e.target===$(id))closeDialog(id)});
   $('importFile').addEventListener('change',e=>addUploads([...e.target.files]));$('compareFile').addEventListener('change',e=>compareFile(e.target.files?.[0]));
 audio.addEventListener('timeupdate',()=>{const d=audio.duration||soundById(state.selected)?.duration||0;$('currentTime').textContent=formatTime(audio.currentTime);$('totalTime').textContent=formatTime(d);let percent=d?audio.currentTime/d*100:0;$('progressRange').value=percent;$('progressRange').style.setProperty('--range-progress',percent+'%');});
 audio.addEventListener('loadedmetadata',()=>{$('totalTime').textContent=formatTime(audio.duration);});
 for(const event of ['play','pause','ended'])audio.addEventListener(event,updatePlayIcons);
 audio.addEventListener('ended',()=>{audio.currentTime=0;updatePlayIcons();});
 audio.addEventListener('error',()=>{if(audio.src)toast('Lỗi tải âm thanh, vui lòng kiểm tra thư mục assets/audio.','error');});
}
function initHero(){let seed=10;const bars=Array.from({length:67},(_,i)=>{let x=i/66;let hill=.25+.75*Math.pow(Math.sin(Math.PI*x),1.8);let v=(Math.sin(i*.97+seed)*.5+.5)*hill;return `<span style="height:${7+Math.round(v*125)}px"></span>`;});$('heroBars').innerHTML=bars.join('');const mic=Array.from({length:19},(_,i)=>`<i style="--h:${8+Math.round(16*Math.abs(Math.sin(i*1.31)))}px;--d:${.15+(i%5)*.06}s"></i>`).join('');$('micBars').innerHTML=mic;}

/* Cloud extension — the UI is available without configuration, but only Supabase
   with SQL/RLS makes accounts, private files and admin permissions real. */
function showDialog(id){$(id).hidden=false;document.body.style.overflow='hidden';}
function closeDialog(id){$(id).hidden=true; if([...document.querySelectorAll('.modal-backdrop')].every(x=>x.hidden)) document.body.style.overflow='';}
function openAccountDialog(){refreshAccount();showDialog('accountModal');}
function openUploadDialog(){
  if(!cloud.enabled){toast('Chưa kết nối Supabase: tệp thêm vào chỉ nằm trong phiên hiện tại.','info');$('importFile').click();return;}
  if(!cloud.user){openAccountDialog();toast('Hãy đăng nhập trước khi đăng tải SFX.');return;}
  $('cloudUploadForm').reset();showDialog('cloudUploadModal');
}
function setAuthMode(mode){authMode=mode;
  document.querySelectorAll('[data-auth-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.authMode===mode));
  $('authSubmit').textContent=mode==='signup'?'Tạo tài khoản':'Đăng nhập';
  $('authPassword').autocomplete=mode==='signup'?'new-password':'current-password';
}
function refreshAccount(){
  const ready=cloud.enabled,user=cloud.user;
  $('cloudNotConfigured').hidden=ready;
  $('accountLoggedOut').hidden=!ready||Boolean(user);
  $('accountLoggedIn').hidden=!ready||!user;
  $('accountIntro').textContent=user?'Quản lý tệp âm thanh và quyền truy cập của bạn.':'Đăng nhập để tải lên SFX công khai hoặc riêng tư.';
  const avatar=document.querySelector('.topbar .avatar');
  avatar.textContent=user?.email?.charAt(0).toUpperCase()||'G';
  avatar.title=user?.email||'Đăng nhập / Đăng ký';
  if(user){$('accountEmail').textContent=user.email||'';$('accountLetter').textContent=avatar.textContent;
    $('accountRole').textContent=cloud.role==='admin'?'Quản trị viên':'Thành viên';$('adminOpen').hidden=cloud.role!=='admin';}
}
async function handleAuthForm(e){
  e.preventDefault();if(!cloud.enabled){toast('Chưa kết nối Supabase.','error');return;}
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  const btn=$('authSubmit');btn.disabled=true;btn.textContent='Đang xử lý...';
  try{
    if(authMode==='signup'){
      const res=await cloud.signUp(email,password);
      toast(res.session?'Đã tạo tài khoản và đăng nhập.':'Đăng ký thành công. Kiểm tra email để xác nhận tài khoản.','success');
    } else { await cloud.signIn(email,password); toast('Đăng nhập thành công.','success'); }
    $('authPassword').value='';
    if(authMode==='signin')closeDialog('accountModal');
  } catch(err){toast('Đăng nhập/đăng ký không thành công: '+(err.message||err),'error');}
  finally{btn.disabled=false;btn.textContent=authMode==='signup'?'Tạo tài khoản':'Đăng nhập';}
}
async function handleGoogleLogin(){
  if(!cloud.enabled){toast('Chưa kết nối Supabase. Vui lòng cấu hình trước.','error');return;}
  const btn=$('authGoogle');btn.disabled=true;
  try { await cloud.signInWithGoogle(); }
  catch(err){toast('Không thể đăng nhập Google: '+(err.message||err),'error');btn.disabled=false;}
}
async function handleLogout(){try{await cloud.signOut();closeDialog('accountModal');toast('Đã đăng xuất.','success');}catch(err){toast(err.message||String(err),'error');}}
async function handleUploadForm(e){e.preventDefault();if(!cloud.user){openAccountDialog();return;}
  const file=$('cloudFile').files[0],btn=$('uploadSubmit');btn.disabled=true;btn.textContent='Đang tải lên...';
  try{
    cloud.validateAudio(file);
    const buffer=await decodeBlob(file);
    const visibility=document.querySelector('input[name="cloudVisibility"]:checked')?.value||'private';
    await cloud.upload(file,{title:$('cloudTitle').value,description:$('cloudDescription').value,category:$('cloudCategory').value,visibility,duration:buffer.duration});
    toast('Đã lưu SFX ở chế độ '+(visibility==='public'?'công khai':'riêng tư')+'.','success');
    closeDialog('cloudUploadModal');await refreshCloudSounds();setView('uploads');
  }catch(err){toast('Không thể đăng tải: '+(err.message||err),'error');}
  finally{btn.disabled=false;btn.textContent='Tải lên và lưu';}
}
function mapCloudRow(r){return {id:'cloud-'+r.id, dbId:r.id, owner_id:r.owner_id,visibility:r.visibility,storage_bucket:r.storage_bucket,storage_path:r.storage_path,
    name:r.title,description:r.description||'Hiệu ứng âm thanh do cộng đồng đóng góp.',category:r.category,emoji:'🎧',
    tags:['cộng đồng',r.visibility==='private'?'cá nhân':'công khai'],duration:r.duration||0,fileName:r.file_name,src:r.src,
    colors:['#6451a8','#243f6d'],uploaded:true,cloud:true,date:r.created_at};
}
async function refreshCloudSounds(){
  if(!cloud.enabled)return;
  const version=++cloudQueryVersion;
  // Clear previous account's private URLs immediately on authentication changes.
  for(let i=sounds.length-1;i>=0;i--)if(sounds[i].cloud)sounds.splice(i,1);
  if(!soundById(state.selected)&&sounds.length){state.selected=sounds[0].id;audio.pause();audio.src=getSrc(sounds[0]);audio.load();}
  updateLibrary();paintDetail();paintPlayer();
  try{
    const rows=await cloud.listSounds();
    if(version!==cloudQueryVersion)return;
    sounds.push(...rows.map(mapCloudRow));
    updateLibrary();paintDetail();paintPlayer();
  }catch(err){if(version===cloudQueryVersion){console.error(err);toast('Không tải được thư viện trên máy chủ: '+(err.message||err),'error');}}
}
async function handleDeleteCloud(id){const s=soundById(id);
  if(!s?.cloud)return;
  if(!confirm('Bạn có chắc muốn xóa “'+s.name+'” khỏi máy chủ?'))return;
  try{await cloud.deleteSound(s);toast('Đã xóa SFX.','success');await refreshCloudSounds();if(!$('adminModal').hidden)paintAdminList();}
  catch(err){toast('Không thể xóa SFX: '+(err.message||err),'error');}
}
function paintAdminList(){
 const items=sounds.filter(s=>s.cloud&&s.visibility==='public');
 $('adminSoundList').innerHTML=items.length?items.map(s=>`<div class="admin-sound-row"><span><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.category)} · ${escapeHtml(s.owner_id.slice(0,8))}…</small></span><button type="button" data-action="delete-cloud" data-id="${escapeHtml(s.id)}">Gỡ xuống</button></div>`).join(''):'<p class="cloud-hint">Chưa có SFX cộng đồng nào được đăng công khai.</p>';
}
function openAdminDialog(){if(!cloud.user||cloud.role!=='admin'){toast('Chỉ tài khoản admin mới được truy cập.','error');return;}
 closeDialog('accountModal');paintAdminList();showDialog('adminModal');
}
async function startCloud(){
 if(!cloud.enabled){refreshAccount();return;}
 try{await cloud.init(async()=>{refreshAccount();await refreshCloudSounds();});}
 catch(err){console.error(err);toast('Kết nối Supabase không thành công: '+(err.message||err),'error');}
}

function init(){injectIcons();initHero();renderCategories();addEvents();audio.volume=.75;$('volumeRange').style.setProperty('--range-progress','75%');if(sounds.length){selectSound(sounds[0].id);audio.src=sounds[0].file;audio.load();}else{toast('Không tìm thấy thư viện âm thanh.','error');}updateLibrary();startCloud();}
init();
})();
