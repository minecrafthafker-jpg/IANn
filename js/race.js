// race.js - einfaches Top-Down Rennspiel (Ausweichen)
(function(){
  const canvas = document.getElementById('raceCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highscoreEl = document.getElementById('highscore');
  const btnRestart = document.getElementById('btnRestart');
  const btnLeaderboard = document.getElementById('btnLeaderboard');
  const overlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const playerNameInput = document.getElementById('playerName');
  const saveScoreBtn = document.getElementById('saveScore');
  const closeOverlayBtn = document.getElementById('closeOverlay');

  const cw = canvas.width, ch = canvas.height;
  let laneCount = 3;
  let laneWidth = cw / laneCount;

  // player
  const car = { lane:1, x:0, y: ch - 120, w: laneWidth * 0.6, h: 100, color: '#ffd966' };

  let obstacles = [];
  let spawnTimer = 0;
  let spawnInterval = 90; // frames
  let speed = 3; // obstacle speed
  let frame = 0;
  let score = 0;
  let running = true;
  let rafId = null;

  // load highscore from Firestore (optional)
  const getHighscore = async ()=>{
    try{
      if(window.db){
        const q = await window.db.collection('scores').orderBy('score','desc').limit(1).get();
        if(!q.empty){
          const doc = q.docs[0].data();
          highscoreEl.textContent = doc.score + ' (' + (doc.name||'—') + ')';
          return;
        }
      }
    }catch(e){console.warn('Highscore fetch failed', e)}
    highscoreEl.textContent = '—';
  }

  function resize(){
    laneWidth = canvas.width / laneCount;
    car.w = laneWidth * 0.6;
    car.x = car.lane * laneWidth + (laneWidth - car.w)/2;
  }

  function spawnObstacle(){
    const lane = Math.floor(Math.random()*laneCount);
    const w = laneWidth * (0.5 + Math.random()*0.4);
    const h = 40 + Math.floor(Math.random()*40);
    const x = lane * laneWidth + (laneWidth - w)/2;
    obstacles.push({x,y:-h,lane,w,h});
  }

  function update(){
    if(!running) return;
    frame++;
    spawnTimer++;
    if(spawnTimer >= spawnInterval){
      spawnTimer = 0;
      spawnObstacle();
      // gradually increase difficulty
      if(frame % 600 === 0 && spawnInterval > 40) spawnInterval -= 5;
      if(frame % 400 === 0) speed += 0.3;
    }

    // move obstacles
    for(let i=0;i<obstacles.length;i++){
      obstacles[i].y += speed;
    }
    // remove offscreen
    obstacles = obstacles.filter(o=> o.y < ch + 100);

    // collision detection
    for(const o of obstacles){
      if(rectIntersect(o.x, o.y, o.w, o.h, car.x, car.y, car.w, car.h)){
        gameOver();
        return;
      }
    }

    // scoring: increase over time
    if(frame % 30 === 0){ score += 1; scoreEl.textContent = score; }
  }

  function rectIntersect(x1,y1,w1,h1,x2,y2,w2,h2){
    return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1);
  }

  function drawRoad(){
    // background
    ctx.fillStyle = '#071022';
    ctx.fillRect(0,0,cw,ch);

    // lanes
    for(let i=0;i<laneCount;i++){
      const lx = i * laneWidth;
      ctx.fillStyle = i%2===0 ? '#07182a' : '#061425';
      ctx.fillRect(lx,0,laneWidth,ch);
      // lane separators
      if(i < laneCount-1){
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        const sx = lx + laneWidth - 2;
        ctx.beginPath();
        ctx.setLineDash([12,12]);
        ctx.moveTo(sx,0); ctx.lineTo(sx,ch); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function draw(){
    drawRoad();
    // draw obstacles
    for(const o of obstacles){
      ctx.fillStyle = '#e85a5a';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      // small highlight
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(o.x+4, o.y+4, o.w-8, o.h-8);
    }

    // draw car
    ctx.fillStyle = car.color;
    ctx.fillRect(car.x, car.y, car.w, car.h);
    // windows
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(car.x + car.w*0.12, car.y + car.h*0.18, car.w*0.76, car.h*0.4);
  }

  function loop(){
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function gameOver(){
    running = false;
    cancelAnimationFrame(rafId);
    finalScoreEl.textContent = score;
    overlay.classList.remove('hidden');
  }

  function restart(){
    obstacles = [];
    spawnTimer = 0;
    spawnInterval = 90;
    speed = 3;
    frame = 0;
    score = 0;
    scoreEl.textContent = score;
    running = true;
    overlay.classList.add('hidden');
    loop();
    getHighscore();
  }

  // controls: left/right
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'){
      if(car.lane > 0){ car.lane--; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }
    } else if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'){
      if(car.lane < laneCount-1){ car.lane++; car.x = car.lane * laneWidth + (laneWidth - car.w)/2; }
    }
  });

  btnRestart.addEventListener('click', ()=>{ restart(); });

  // save score
  saveScoreBtn.addEventListener('click', async ()=>{
    const name = (playerNameInput.value || 'anonymous').substring(0,40);
    if(window.db){
      try{
        await window.db.collection('scores').add({ name, score, createdAt: new Date().toISOString() });
        alert('Score gespeichert!');
        overlay.classList.add('hidden');
        getHighscore();
      }catch(e){
        console.warn('Save failed', e); alert('Score konnte nicht gespeichert werden.');
      }
    } else {
      alert('Firebase nicht konfiguriert. Score nicht gespeichert.');
    }
  });

  closeOverlayBtn.addEventListener('click', ()=>{ overlay.classList.add('hidden'); });

  btnLeaderboard.addEventListener('click', async ()=>{
    // open a simple leaderboard in a new window (fetch top 10)
    if(window.db){
      try{
        const q = await window.db.collection('scores').orderBy('score','desc').limit(10).get();
        let txt = 'Top 10\n';
        let i=1;
        q.forEach(doc=>{ const d = doc.data(); txt += `${i}. ${d.name||'anon'} — ${d.score}\n`; i++; });
        alert(txt);
      }catch(e){ console.warn('Leaderboard fetch failed', e); alert('Leaderboard konnte nicht geladen werden.'); }
    } else {
      alert('Firebase nicht konfiguriert.');
    }
  });

  // responsive setup
  function fitCanvas(){
    const parent = canvas.parentElement;
    const w = Math.min(420, parent.clientWidth - 20);
    canvas.width = w;
    canvas.height = Math.floor(w * (600/360));
    resize();
    draw();
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // start
  getHighscore();
  loop();
})();
