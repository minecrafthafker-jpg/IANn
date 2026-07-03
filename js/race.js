// race.js - full single-screen game with shop, 5 lanes, 10 cars, points & Firestore persistence
(function(){
  // Firebase init (compat) if available
  if(window.firebaseConfig && typeof firebase !== 'undefined'){
    try{ if(!firebase.apps.length) firebase.initializeApp(window.firebaseConfig); window.db = firebase.firestore(); }catch(e){console.warn('Firebase init error', e);} }

  // DOM
  const canvas = document.getElementById('raceCanvas');
  const ctx = canvas.getContext('2d');
  const pointsEl = document.getElementById('points');
  const scoreEl = document.getElementById('score');
  const highscoreEl = document.getElementById('highscore');
  const btnRestart = document.getElementById('btnRestart');
  const btnLeaderboard = document.getElementById('btnLeaderboard');
  const carsGrid = document.getElementById('carsGrid');
  const overlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const playerNameInput = document.getElementById('playerName');
  const saveScoreBtn = document.getElementById('saveScore');
  const closeOverlayBtn = document.getElementById('closeOverlay');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');

  // Canvas sizing
  function fitCanvas(){
    const parent = canvas.parentElement;
    const w = Math.min(540, parent.clientWidth - 20);
    canvas.width = w;
    canvas.height = Math.floor(w * (900/540));
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Game vars
  const laneCount = 5;
  let laneWidth = canvas.width / laneCount;
  let car = { lane:2, w:0, h:0, x:0, y:0, color:'#ffd966', selected:0 };
  let obstacles = [];
  let spawnTimer = 0, spawnInterval = 70, speed = 3, frame = 0;
  let score = 0, running = true, rafId = null;

  // Player data (local + Firestore)
  let player = { id:null, points:0, owned:[], selected:0 };

  // Cars data (prices)
  const cars = Array.from({length:10}, (_,i)=>({ id:i+1, name:`Car ${i+1}`, price: i===0?0: [100,250,500,900,1500,2300,3400,5000,7500][i-1] }));

  // load car assets
  const carImgs = cars.map(c=>{ const img=new Image(); img.src=`assets/cars/car${c.id}.svg`; return img; });
  const obstacleImg = new Image(); obstacleImg.src='assets/obstacle.svg';

  function resizeEntities(){
    laneWidth = canvas.width / laneCount;
    car.w = laneWidth * 0.6; car.h = car.w * 1.1; car.y = canvas.height - car.h - 30;
    car.x = car.lane * laneWidth + (laneWidth - car.w)/2;
  }

  function ensurePlayer(){
    let id = localStorage.getItem('playerId');
    if(!id){ id = 'p_' + Math.random().toString(36).slice(2,10); localStorage.setItem('playerId', id); }
    player.id = id;

    // try load from localStorage
    const stored = localStorage.getItem('playerData');
    if(stored){ try{ const p = JSON.parse(stored); if(p.id===player.id){ player = p; } }catch(e){} }

    // try load from Firestore if available
    if(window.db){
      window.db.collection('users').doc(player.id).get().then(doc=>{
        if(doc.exists){ const d=doc.data(); player.points = d.points||player.points; player.owned = d.owned||player.owned; player.selected = d.selected||player.selected; applyPlayer(); saveLocal(); }
        else { // create
          window.db.collection('users').doc(player.id).set({ points: player.points, owned: player.owned, selected: player.selected, createdAt: new Date().toISOString() }).catch(e=>console.warn(e));
        }
      }).catch(e=>console.warn('users get failed', e));
    } else {
      applyPlayer();
    }
  }

  function saveLocal(){ localStorage.setItem('playerData', JSON.stringify(player)); updateUI(); }
  async function saveRemote(){ if(!window.db) return; try{ await window.db.collection('users').doc(player.id).set({ points: player.points, owned: player.owned, selected: player.selected, updatedAt: new Date().toISOString() }, { merge:true }); }catch(e){console.warn('saveRemote failed', e);} }

  function applyPlayer(){ if(player.selected) car.selected = player.selected; if(player.owned.length===0) player.owned = [1]; if(!player.owned.includes(1)) player.owned.unshift(1); car.selected = player.selected || player.owned[0]; car.lane = 2; resizeEntities(); updateUI(); }

  function updateUI(){ pointsEl.textContent = player.points; scoreEl.textContent = score; }

  function renderShop(){
    carsGrid.innerHTML = '';
    for(const c of cars){
      const card = document.createElement('div'); card.className='car-card';
      const img = document.createElement('img'); img.src = `assets/cars/car${c.id}.svg`;
      const meta = document.createElement('div'); meta.className='car-meta';
      meta.innerHTML = `<div><strong>${c.name}</strong></div><div class="muted">Preis: ${c.price}</div>`;
      const btnWrap = document.createElement('div');
      if(player.owned.includes(c.id)){
        const sel = document.createElement('button'); sel.className='select-btn'; sel.textContent = player.selected===c.id? 'Ausgewählt':'Auswählen'; sel.onclick = ()=>{ player.selected = c.id; car.selected = c.id; saveLocal(); saveRemote(); renderShop(); };
        btnWrap.appendChild(sel);
      } else {
        const buy = document.createElement('button'); buy.className='buy-btn'; buy.textContent='Kaufen'; buy.onclick = ()=>{ attemptBuy(c.id, c.price); };
        btnWrap.appendChild(buy);
      }
      card.appendChild(img); card.appendChild(meta); card.appendChild(btnWrap);
      carsGrid.appendChild(card);
    }
  }

  function attemptBuy(carId, price){
    if(player.points >= price){
      player.points -= price; player.owned.push(carId); player.selected = carId; saveLocal(); saveRemote(); renderShop(); updateUI(); alert('Gekauft!');
    } else { alert('Nicht genug Punkte'); }
  }

  function spawnObstacle(){
    const lane = Math.floor(Math.random()*laneCount);
    const w = laneWidth * (0.5 + Math.random()*0.3);
    const h = 30 + Math.floor(Math.random()*50);
    const x = lane * laneWidth + (laneWidth - w)/2;
    obstacles.push({x,y:-h,lane,w,h, scored:false});
  }

  function update(){
    if(!running) return;
    frame++; spawnTimer++;
    if(spawnTimer >= spawnInterval){ spawnTimer=0; spawnObstacle(); if(frame%600===0 && spawnInterval>30) spawnInterval-=5; if(frame%400===0) speed+=0.3; }

    // move
    for(const o of obstacles) o.y += speed;
    obstacles = obstacles.filter(o=> o.y < canvas.height + 200);

    // scoring: +1 every 30 frames and bonus when obstacle passes beyond player without collision
    if(frame % 30 === 0){ score++; }

    for(const o of obstacles){
      if(!o.scored && o.y > car.y + car.h){ // obstacle passed the player's y
        o.scored = true; player.points += 2; // bonus
        saveLocal(); saveRemote(); updateUI();
      }
      if(rectIntersect(o.x, o.y, o.w, o.h, car.x, car.y, car.w, car.h)){
        gameOver(); return;
      }
    }
  }

  function rectIntersect(x1,y1,w1,h1,x2,y2,w2,h2){ return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1); }

  function draw(){
    // clear
    ctx.fillStyle='#071022'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // lanes
    for(let i=0;i<laneCount;i++){ const lx = i*laneWidth; ctx.fillStyle = i%2===0? '#07182a':'#061425'; ctx.fillRect(lx,0,laneWidth,canvas.height); if(i<laneCount-1){ ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.setLineDash([16,12]); ctx.beginPath(); ctx.moveTo(lx+laneWidth-2,0); ctx.lineTo(lx+laneWidth-2,canvas.height); ctx.stroke(); ctx.setLineDash([]); }}

    // obstacles
    for(const o of obstacles){ if(obstacleImg.complete) ctx.drawImage(obstacleImg,o.x,o.y,o.w,o.h); else { ctx.fillStyle='#e85a5a'; ctx.fillRect(o.x,o.y,o.w,o.h);} }

    // draw car (selected sprite)
    const sel = car.selected || 1; const img = carImgs[sel-1]; if(img && img.complete){ ctx.drawImage(img, car.x, car.y, car.w, car.h); } else { ctx.fillStyle=car.color; ctx.fillRect(car.x,car.y,car.w,car.h); }
  }

  function loop(){ update(); draw(); scoreEl.textContent = score; rafId=requestAnimationFrame(loop); }

  function gameOver(){ running=false; cancelAnimationFrame(rafId); finalScoreEl.textContent = score; overlay.classList.remove('hidden'); // award points for survival
    const earned = Math.floor(score/5); player.points += earned; saveLocal(); saveRemote(); updateUI(); }

  function restart(){ obstacles=[]; spawnTimer=0; spawnInterval=70; speed=3; frame=0; score=0; running=true; overlay.classList.add('hidden'); car.lane=2; resizeEntities(); loop(); }

  // controls
  window.addEventListener('keydown',(e)=>{ if(e.key==='ArrowLeft'||e.key==='a'){ if(car.lane>0){ car.lane--; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }} else if(e.key==='ArrowRight'||e.key==='d'){ if(car.lane<laneCount-1){ car.lane++; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }} });
  leftBtn.addEventListener('touchstart', e=>{ e.preventDefault(); if(car.lane>0){ car.lane--; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }});
  rightBtn.addEventListener('touchstart', e=>{ e.preventDefault(); if(car.lane<laneCount-1){ car.lane++; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }});
  leftBtn.addEventListener('mousedown', ()=>{ if(car.lane>0){ car.lane--; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }});
  rightBtn.addEventListener('mousedown', ()=>{ if(car.lane<laneCount-1){ car.lane++; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }});

  btnRestart.addEventListener('click', restart);
  btnLeaderboard.addEventListener('click', ()=>{ window.location.href='leaderboard.html'; });

  saveScoreBtn.addEventListener('click', async ()=>{ const name = (playerNameInput.value||'anonymous').substring(0,40); if(window.db){ try{ await window.db.collection('scores').add({ name, score, createdAt: new Date().toISOString() }); alert('Score gespeichert!'); overlay.classList.add('hidden'); }catch(e){ console.warn(e); alert('Score konnte nicht gespeichert werden.'); } } else { alert('Firebase nicht konfiguriert.'); } });
  closeOverlayBtn.addEventListener('click', ()=>{ overlay.classList.add('hidden'); });

  // responsive
  function resizeEntities(){ laneWidth = canvas.width / laneCount; car.w = laneWidth * 0.6; car.h = car.w * 1.1; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; car.y = canvas.height - car.h - 30; }

  // leaderboard fetch initially
  async function getHighscore(){ try{ if(window.db){ const q = await window.db.collection('scores').orderBy('score','desc').limit(1).get(); if(!q.empty){ const doc=q.docs[0].data(); highscoreEl.textContent = doc.score + ' (' + (doc.name||'—') + ')'; return; } } }catch(e){ console.warn(e);} highscoreEl.textContent='—'; }

  // init
  ensurePlayer(); renderShop(); resizeEntities(); getHighscore(); loop();

})();
