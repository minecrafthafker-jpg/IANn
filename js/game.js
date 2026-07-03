// Simple Snake game (vanilla JS)
(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const btnRestart = document.getElementById('btnRestart');

  const tileCount = 20; // grid cells per row/col
  let tileSize = canvas.width / tileCount;

  let snake = [{x:9,y:9}];
  let velocity = {x:0,y:0};
  let food = {x:5,y:5};
  let score = 0;
  let gameInterval = null;
  let speed = 120; // ms per tick

  function resizeTile(){
    tileSize = Math.floor(Math.min(canvas.width, canvas.height) / tileCount);
  }

  function placeFood(){
    let found=false;
    while(!found){
      const x = Math.floor(Math.random()*tileCount);
      const y = Math.floor(Math.random()*tileCount);
      if(!snake.some(s=>s.x===x && s.y===y)){
        food = {x,y};
        found = true;
      }
    }
  }

  function draw(){
    // clear
    ctx.fillStyle = '#031025';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw food
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(food.x*tileSize + 2, food.y*tileSize + 2, tileSize - 4, tileSize - 4);

    // draw snake
    for(let i=0;i<snake.length;i++){
      ctx.fillStyle = i===0 ? '#fff' : 'rgba(230,238,248,0.85)';
      const s = snake[i];
      ctx.fillRect(s.x*tileSize + 1, s.y*tileSize + 1, tileSize - 2, tileSize - 2);
    }
  }

  function tick(){
    // move head
    const head = {x: snake[0].x + velocity.x, y: snake[0].y + velocity.y};

    // wall collision
    if(head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount){
      gameOver();
      return;
    }

    // self collision
    if(snake.some(s => s.x === head.x && s.y === head.y)){
      gameOver();
      return;
    }

    snake.unshift(head);

    // ate food?
    if(head.x === food.x && head.y === food.y){
      score += 1;
      scoreEl.textContent = score;
      placeFood();
      // optionally speed up
      if(score % 5 === 0 && speed > 40){
        speed = Math.max(40, speed - 8);
        restartInterval();
      }
    } else {
      snake.pop();
    }

    draw();
  }

  function gameOver(){
    clearInterval(gameInterval);
    alert('Game over — Score: ' + score);
  }

  function restart(){
    clearInterval(gameInterval);
    snake = [{x:9,y:9}];
    velocity = {x:0,y:0};
    score = 0;
    scoreEl.textContent = score;
    speed = 120;
    placeFood();
    draw();
    restartInterval();
  }

  function restartInterval(){
    if(gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(tick, speed);
  }

  // controls
  window.addEventListener('keydown', (e)=>{
    const key = e.key;
    if(key === 'ArrowUp' || key === 'w' || key === 'W'){
      if(velocity.y === 1) return; velocity = {x:0,y:-1};
    } else if(key === 'ArrowDown' || key === 's' || key === 'S'){
      if(velocity.y === -1) return; velocity = {x:0,y:1};
    } else if(key === 'ArrowLeft' || key === 'a' || key === 'A'){
      if(velocity.x === 1) return; velocity = {x:-1,y:0};
    } else if(key === 'ArrowRight' || key === 'd' || key === 'D'){
      if(velocity.x === -1) return; velocity = {x:1,y:0};
    }
  });

  btnRestart.addEventListener('click', restart);

  // init
  resizeTile();
  placeFood();
  draw();
  restartInterval();

  // responsive canvas: keep square
  function fitCanvas(){
    const parent = canvas.parentElement;
    const w = Math.min(480, parent.clientWidth - 20);
    canvas.width = w;
    canvas.height = w;
    resizeTile();
    draw();
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();
})();
