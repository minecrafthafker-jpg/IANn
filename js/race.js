// race.js - local logos, smaller canvas, audio feedback, collision animation, Top-10 sidebar
(function(){
  // audio helper (WebAudio synth)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  function playBeep(freq=440, time=0.08, type='sine', gain=0.12){ if(!audioCtx) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = gain; o.connect(g); g.connect(audioCtx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time); o.stop(audioCtx.currentTime + time + 0.02); }
  function playCollision(){ playBeep(100,0.18,'square',0.18); }
  function playPurchase(){ playBeep(880,0.12,'sine',0.08); }

  if(window.firebaseConfig && typeof firebase !== 'undefined'){
    try{ if(!firebase.apps.length) firebase.initializeApp(window.firebaseConfig); window.db = firebase.firestore(); }catch(e){console.warn('Firebase init error', e);} }

  // DOM
  const canvas = document.getElementById('raceCanvas');
  const ctx = canvas.getContext('2d');
  const pointsEl = document.getElementById('points');
  const scoreEl = document.getElementById('score');
  const highscoreEl = document.getElementById('highscore');
  const btnRestart = document.getElementById('btnRestart');
  const carsGrid = document.getElementById('carsGrid');
  const top10El = document.getElementById('top10');
  const overlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const playerNameInput = document.getElementById('playerName');
  const saveScoreBtn = document.getElementById('saveScore');
  const closeOverlayBtn = document.getElementById('closeOverlay');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');

  // sizing
  function fitCanvas(){ const parent = canvas.parentElement; const w = Math.min(360, parent.clientWidth - 20); canvas.width = w; canvas.height = Math.floor(w * (800/360)); }
  window.addEventListener('resize', fitCanvas); fitCanvas();

  const laneCount = 5; let laneWidth = canvas.width / laneCount;
  let car = { lane:2, w:0, h:0, x:0, y:0, selected:1, shield:0, double:0 };
  let obstacles=[]; let powerups=[]; let spawnTimer=0, spawnInterval=70, speed=3, frame=0; let score=0, running=true, rafId=null;
  let shake = 0;

  let player={ id:null, points:0, owned:[1], selected:1 };

  // local logo files (must exist in assets/cars/)
  const brandImgs = [];
  for(let i=1;i<=10;i++){ const img = new Image(); img.src = `assets/cars/car${i}.svg`; img.onerror = ()=>{ /* fallback handled elsewhere */ }; brandImgs.push(img); }

  const brands = [
    {id:1,name:'Toyota', price:0}, {id:2,name:'Mercedes', price:150}, {id:3,name:'BMW', price:300}, {id:4,name:'Audi', price:500},
    {id:5,name:'Ferrari', price:900}, {id:6,name:'Porsche', price:1500}, {id:7,name:'Lamborghini', price:2300}, {id:8,name:'Ford', price:3400},
    {id:9,name:'Chevrolet', price:5000}, {id:10,name:'Tesla', price:7500}
  ];

  function resizeEntities(){ laneWidth = canvas.width / laneCount; car.w = laneWidth * 0.6; car.h = car.w * 1.1; car.y = canvas.height - car.h - 20; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }

  function ensurePlayer(){ let id = localStorage.getItem('playerId'); if(!id){ id = 'p_'+Math.random().toString(36).slice(2,10); localStorage.setItem('playerId', id);} player.id=id; const stored = localStorage.getItem('playerData'); if(stored){ try{ const p=JSON.parse(stored); if(p.id===player.id) player = p;}catch(e){} } if(!player.owned||player.owned.length===0) player.owned=[1]; if(!player.selected) player.selected = player.owned[0]; applyPlayer(); if(window.db){ window.db.collection('users').doc(player.id).get().then(doc=>{ if(doc.exists){ const d=doc.data(); player.points=d.points||player.points; player.owned=d.owned||player.owned; player.selected=d.selected||player.selected; applyPlayer(); saveLocal(); } else { window.db.collection('users').doc(player.id).set({ points:player.points, owned:player.owned, selected:player.selected, createdAt:new Date().toISOString() }).catch(e=>console.warn(e)); } }).catch(e=>console.warn(e)); } }

  function saveLocal(){ localStorage.setItem('playerData', JSON.stringify(player)); updateUI(); }
  async function saveRemote(){ if(!window.db) return; try{ await window.db.collection('users').doc(player.id).set({ points:player.points, owned:player.owned, selected:player.selected, updatedAt:new Date().toISOString() }, { merge:true }); }catch(e){console.warn(e);} }

  function applyPlayer(){ car.selected = player.selected || player.owned[0]; car.lane = 2; resizeEntities(); renderShop(); updateUI(); renderTop10(); }

  function updateUI(){ pointsEl.textContent = player.points; scoreEl.textContent = score; }

  function renderShop(){ carsGrid.innerHTML=''; for(const b of brands){ const card=document.createElement('div'); card.className='car-card'; const img=document.createElement('img'); img.src = `assets/cars/car${b.id}.svg`; img.onerror=()=>{ img.src = `assets/cars/car${b.id}.svg`; }; const meta=document.createElement('div'); meta.className='car-meta'; meta.innerHTML=`<div><strong>${b.name}</strong></div><div class="muted">Preis: ${b.price}</div>`; const btnWrap=document.createElement('div'); if(player.owned.includes(b.id)){ const sel=document.createElement('button'); sel.className='select-btn'; sel.textContent = player.selected===b.id ? 'Ausgewählt' : 'Auswählen'; sel.onclick=()=>{ player.selected=b.id; car.selected=b.id; saveLocal(); saveRemote(); renderShop(); }; btnWrap.appendChild(sel); } else { const buy=document.createElement('button'); buy.className='buy-btn'; buy.textContent='Kaufen'; buy.onclick=()=>{ attemptBuy(b.id,b.price); }; btnWrap.appendChild(buy); } card.appendChild(img); card.appendChild(meta); card.appendChild(btnWrap); carsGrid.appendChild(card); } }

  function attemptBuy(id,price){ if(player.points>=price){ player.points-=price; player.owned.push(id); player.selected=id; saveLocal(); saveRemote(); renderShop(); updateUI(); playPurchase(); alert('Gekauft!'); } else alert('Nicht genug Punkte'); }

  function spawnObstacle(){ const lane=Math.floor(Math.random()*laneCount); const w=laneWidth*(0.5+Math.random()*0.28); const h=30+Math.floor(Math.random()*40); const x=lane*laneWidth+(laneWidth-w)/2; obstacles.push({x,y:-h,lane,w,h,scored:false}); }

  function spawnPowerup(){ if(Math.random()<0.06){ const lane=Math.floor(Math.random()*laneCount); const type = Math.random()<0.5? 'shield':'double'; const size=24; const x=lane*laneWidth+(laneWidth-size)/2; powerups.push({x,y:-size,lane,type,size}); } }

  function update(){ if(!running) return; frame++; spawnTimer++; if(spawnTimer>=spawnInterval){ spawnTimer=0; spawnObstacle(); spawnPowerup(); if(frame%600===0 && spawnInterval>30) spawnInterval-=5; if(frame%400===0) speed+=0.25; } for(const o of obstacles) o.y+=speed; for(const p of powerups) p.y+=speed; obstacles=obstacles.filter(o=>o.y<canvas.height+200); powerups=powerups.filter(p=>p.y<canvas.height+100); if(frame%30===0){ score += car.double>0 ? 2 : 1; } for(const o of obstacles){ if(!o.scored && o.y>car.y+car.h){ o.scored=true; player.points += car.double>0 ? 4 : 2; saveLocal(); saveRemote(); updateUI(); } if(rectIntersect(o.x,o.y,o.w,o.h, car.x,car.y,car.w,car.h)){ if(car.shield>0){ car.shield=0; // consume
          obstacles = obstacles.filter(x=>x!==o);
          continue; }
        // collision
        playCollision(); shake = 12; gameOver(); return; } } for(const p of powerups){ if(rectIntersect(p.x,p.y,p.size,p.size, car.x,car.y,car.w,car.h)){ applyPowerup(p.type); powerups = powerups.filter(x=>x!==p); } }
    if(car.double>0) car.double--; if(car.shield>0) car.shield--; if(shake>0) shake = Math.max(0, shake - 1); }

  function applyPowerup(type){ if(type==='shield'){ car.shield = 600; alert('Shield eingesammelt — nächste Kollision wird verhindert.'); } else if(type==='double'){ car.double = 600; alert('Double Points — vorübergehend doppelte Punkte!'); } }

  function rectIntersect(x1,y1,w1,h1,x2,y2,w2,h2){ return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1); }

  function draw(){ // optional camera shake offset
    const ox = (Math.random()-0.5) * shake; const oy = (Math.random()-0.5) * shake;
    ctx.setTransform(1,0,0,1,ox,oy);
    ctx.fillStyle='#071022'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<laneCount;i++){ const lx=i*laneWidth; ctx.fillStyle = i%2===0? '#07182a':'#061425'; ctx.fillRect(lx,0,laneWidth,canvas.height); if(i<laneCount-1){ ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.setLineDash([12,10]); ctx.beginPath(); ctx.moveTo(lx+laneWidth-2,0); ctx.lineTo(lx+laneWidth-2,canvas.height); ctx.stroke(); ctx.setLineDash([]); } }
    for(const o of obstacles){ ctx.fillStyle='#e85a5a'; ctx.fillRect(o.x,o.y,o.w,o.h); }
    for(const p of powerups){ ctx.fillStyle = p.type==='shield'?'#56ccf2':'#ffd166'; ctx.beginPath(); ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size/2, 0, Math.PI*2); ctx.fill(); }
    const sel = car.selected || 1; const img = brandImgs[sel-1]; if(img && img.complete){ ctx.drawImage(img, car.x, car.y, car.w, car.h); } else { ctx.fillStyle='#ffd966'; ctx.fillRect(car.x,car.y,car.w,car.h); }
    // HUD
    ctx.setTransform(1,0,0,1,0,0);
  }

  function loop(){ update(); draw(); scoreEl.textContent = score; rafId=requestAnimationFrame(loop); }

  function gameOver(){ running=false; cancelAnimationFrame(rafId); finalScoreEl.textContent = score; overlay.classList.remove('hidden'); const earned = Math.floor(score/5); const bonus = car.double>0 ? earned : 0; player.points += earned + bonus; saveLocal(); saveRemote(); updateUI(); renderTop10(); }

  function restart(){ obstacles=[]; powerups=[]; spawnTimer=0; spawnInterval=70; speed=3; frame=0; score=0; running=true; overlay.classList.add('hidden'); car.lane=2; resizeEntities(); loop(); }

  // controls
  window.addEventListener('keydown',(e)=>{ if(e.key==='ArrowLeft'||e.key==='a'){ if(car.lane>0){ car.lane--; car.x=car.lane*laneWidth+(laneWidth-car.w)/2; }} else if(e.key==='ArrowRight'||e.key==='d'){ if(car.lane<laneCount-1){ car.lane++; car.x=car.lane*laneWidth+(laneWidth-car.w)/2; }} });
  leftBtn.addEventListener('touchstart',e=>{ e.preventDefault(); if(car.lane>0){ car.lane--; car.x=car.lane*laneWidth+(laneWidth-car.w)/2; }});
  rightBtn.addEventListener('touchstart',e=>{ e.preventDefault(); if(car.lane<laneCount-1){ car.lane++; car.x=car.lane*laneWidth+(laneWidth-car.w)/2; }});

  // swipe
  let tStartX=null; canvas.addEventListener('touchstart',e=>{ if(e.touches&&e.touches.length===1) tStartX=e.touches[0].clientX; });
  canvas.addEventListener('touchmove',e=>{ if(!tStartX) return; const dx=e.touches[0].clientX - tStartX; if(Math.abs(dx)>30){ if(dx<0 && car.lane<laneCount-1){ car.lane++; car.x=car.lane*laneWidth+(laneWidth-car.w)/2; tStartX=null; } else if(dx>0 && car.lane>0){ car.lane--; car.x=car.lane*laneWidth+(laneWidth-car.w)/2; tStartX=null; } } });
  canvas.addEventListener('touchend',()=>{ tStartX=null; });

  btnRestart.addEventListener('click', restart);

  saveScoreBtn.addEventListener('click',async()=>{ const name=(playerNameInput.value||'anonymous').substring(0,40); if(window.db){ try{ await window.db.collection('scores').add({ name, score, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); alert('Score gespeichert!'); overlay.classList.add('hidden'); renderTop10(); }catch(e){ console.warn(e); alert('Score konnte nicht gespeichert werden.'); } } else alert('Firebase nicht konfiguriert.'); });
  closeOverlayBtn.addEventListener('click',()=>{ overlay.classList.add('hidden'); });

  function resizeEntities(){ laneWidth = canvas.width / laneCount; car.w = laneWidth * 0.6; car.h = car.w * 1.1; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; car.y = canvas.height - car.h - 20; }

  async function renderTop10(){ try{ if(window.db){ const q = await window.db.collection('scores').orderBy('score','desc').limit(10).get(); if(q.empty){ top10El.innerHTML = '<p>Keine Einträge.</p>'; return; } let html = '<ol>'; q.forEach((doc)=>{ const d = doc.data(); const name = d.name || 'anon'; const s = d.score || 0; html += `<li>${escapeHtml(name)} — ${s}</li>`; }); html += '</ol>'; top10El.innerHTML = html; } else { top10El.innerHTML = '<p>Firebase nicht konfiguriert.</p>'; } }catch(e){ console.warn(e); top10El.innerHTML = '<p>Fehler beim Laden der Top10.</p>'; } }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function getHighscore(){ try{ if(window.db){ const q=await window.db.collection('scores').orderBy('score','desc').limit(1).get(); if(!q.empty){ const doc=q.docs[0].data(); highscoreEl.textContent = doc.score + ' (' + (doc.name||'—') + ')'; return; } } }catch(e){console.warn(e);} highscoreEl.textContent='—'; }

  // init
  ensurePlayer(); renderShop(); resizeEntities(); getHighscore(); renderTop10(); loop();

})();
