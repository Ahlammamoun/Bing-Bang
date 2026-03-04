console.log("✅ script.js chargé");

window.addEventListener("DOMContentLoaded", () => {
  const game = document.getElementById("game");
  const character = document.getElementById("character");

  const elScore = document.getElementById("score");
  const elBest = document.getElementById("best");
  const elGameName = document.getElementById("gameName");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const controlsHint = document.getElementById("controlsHint");

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const btnPause = document.getElementById("btnPause");
  const btnMenu = document.getElementById("btnMenu");

  const pickHole = document.getElementById("pickHole");
  const pickFlappy = document.getElementById("pickFlappy");

  const pickSnake = document.getElementById("pickSnake");

  const W = () => game.clientWidth;
  const H = () => game.clientHeight;

  function setOverlay(show) { overlay.classList.toggle("show", show); }

  // ===== Arcade state
  let currentGame = null;     // "hole" | "flappy"
  let instance = null;        // objet du jeu
  let paused = false;

  function setHUD(name, score, best) {
    elGameName.textContent = name;
    elScore.textContent = score;
    elBest.textContent = best;
  }

  function showMenu() {
    paused = false;
    btnPause.textContent = "Pause";
    currentGame = null;
    instance = null;

    cleanupScene();

    overlayTitle.textContent = "Bing Bang Arcade";
    overlayText.textContent = "Choisis un jeu";
    controlsHint.textContent = "";
    setHUD("Menu", 0, 0);
    setOverlay(true);
  }

  function cleanupScene() {
    // enlever obstacles éventuels
    [...game.querySelectorAll(".block,.hole,.pipe")].forEach(el => el.remove());
    // reset ball
    character.style.left = `${(W() / 2) - 11}px`;
    character.style.top = `${H() - 60}px`;
    character.style.display = "block";
  }

  function startSelected() {
    if (!currentGame) {
      overlayText.textContent = "Choisis un jeu d’abord 🙂";
      return;
    }
    paused = false;
    btnPause.textContent = "Pause";
    setOverlay(false);

    cleanupScene();

    if (currentGame === "hole") instance = makeHoleEscape();
    if (currentGame === "flappy") instance = makeFlappyBall();
    if (currentGame === "snake") instance = makeSnake();

    instance.start();
  }

  function restart() {
    if (!instance) { startSelected(); return; }
    paused = false;
    btnPause.textContent = "Pause";
    setOverlay(false);
    cleanupScene();
    instance.start();
  }

  function togglePause() {
    if (!instance) return;
    paused = !paused;
    btnPause.textContent = paused ? "Reprendre" : "Pause";
    if (paused) {
      overlayTitle.textContent = "Pause";
      overlayText.textContent = "Appuie sur Reprendre pour continuer";
      controlsHint.textContent = instance.controls;
      setOverlay(true);
      instance.pause();
    } else {
      setOverlay(false);
      instance.resume();
    }
  }

  // ===== Buttons / Menu picks
  pickHole.addEventListener("click", () => {
    currentGame = "hole";
    overlayText.textContent = "Hole Escape sélectionné ✅";
    controlsHint.textContent = "Contrôles: ← → (ou glisser sur mobile)";
    setHUD("Hole Escape", 0, Number(localStorage.getItem("best_hole") || 0));
  });

  pickFlappy.addEventListener("click", () => {
    currentGame = "flappy";
    overlayText.textContent = "Flappy Ball sélectionné ✅";
    controlsHint.textContent = "Contrôles: Espace / clic / tap = jump";
    setHUD("Flappy Ball", 0, Number(localStorage.getItem("best_flappy") || 0));
  });

  pickSnake.addEventListener("click", () => {
    currentGame = "snake";
    overlayText.textContent = "Snake sélectionné ✅";
    controlsHint.textContent = "Contrôles: ↑ ↓ ← → (ou swipe sur mobile)";
    setHUD("Snake", 0, Number(localStorage.getItem("best_snake") || 0));
  });

  btnStart.addEventListener("click", startSelected);
  btnRestart.addEventListener("click", restart);
  btnPause.addEventListener("click", togglePause);
  btnMenu.addEventListener("click", showMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "p") togglePause();
    if (instance) instance.onKeyDown?.(e);
  });
  document.addEventListener("keyup", (e) => {
    if (instance) instance.onKeyUp?.(e);
  });

  // =========================
  // ====== GAME 1: HOLE ESCAPE
  // =========================
  function makeHoleEscape() {
    const bestKey = "best_hole";
    let best = Number(localStorage.getItem(bestKey) || 0);

    const ball = { x: 0, y: 0, r: 11, vx: 0 };
    const physics = { gravity: 2.2, lift: 0.35 }; // gravity forte pour “tomber” si trou
    let speed = 1.2;
    let spawnEvery = 850;
    let holeWidth = 90;

    let blocks = [];
    let lastSpawn = 0;
    let lastT = 0;
    let running = false;
    let score = 0;

    let leftDown = false, rightDown = false;
    let pointerActive = false, lastX = 0;

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function reset() {
      [...game.querySelectorAll(".block,.hole")].forEach(el => el.remove());
      blocks = [];
      score = 0;
      lastSpawn = 0;
      lastT = 0;

      speed = 1.2;
      spawnEvery = 850;
      holeWidth = 90;

      ball.x = (W() / 2) - ball.r;
      ball.y = H() - 60;
      ball.vx = 0;
      character.style.left = `${ball.x}px`;
      character.style.top = `${ball.y}px`;

      setHUD("Hole Escape", score, best);
    }

    function spawnBlock(y) {
      const elBlock = document.createElement("div");
      elBlock.className = "block";
      elBlock.style.top = `${y}px`;

      const elHole = document.createElement("div");
      elHole.className = "hole";
      elHole.style.top = `${y}px`;

      const width = holeWidth;
      elHole.style.width = `${width}px`;
      const holeX = Math.floor(Math.random() * (W() - width));
      elHole.style.left = `${holeX}px`;

      game.appendChild(elBlock);
      game.appendChild(elHole);

      blocks.push({ y, holeX, width, scored: false, elBlock, elHole });
    }

    function gameOver() {
      running = false;
      if (score > best) {
        best = score;
        localStorage.setItem(bestKey, String(best));
      }
      overlayTitle.textContent = "Game Over";
      overlayText.textContent = `Hole Escape • Score: ${score} • Best: ${best}`;
      controlsHint.textContent = "Recommencer ?";
      setOverlay(true);
      setHUD("Hole Escape", score, best);
    }

    function loop(t) {
      if (!running || paused) return;
      if (!lastT) lastT = t;
      const dt = Math.min(32, t - lastT);
      lastT = t;

      // controls
      const accel = 0.02 * dt;
      const maxV = 0.65 * dt;
      if (leftDown) ball.vx -= accel;
      if (rightDown) ball.vx += accel;
      if (!leftDown && !rightDown) ball.vx *= 0.84;

      ball.vx = clamp(ball.vx, -maxV, maxV);
      ball.x = clamp(ball.x + ball.vx, 0, W() - ball.r * 2);

      // spawn
      lastSpawn += dt;
      if (lastSpawn >= spawnEvery) {
        lastSpawn = 0;
        spawnBlock(H() + 30);

        // difficulté progressive
        speed += 0.03;
        spawnEvery = Math.max(520, spawnEvery - 7);
        holeWidth = Math.max(52, holeWidth - 0.25);
      }

      // move + collisions
      let supported = false;

      const ballLeft = ball.x;
      const ballRight = ball.x + ball.r * 2;
      const ballTop = ball.y;
      const ballBottom = ball.y + ball.r * 2;

      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        b.y -= speed * (dt / 16);

        b.elBlock.style.top = `${b.y}px`;
        b.elHole.style.top = `${b.y}px`;

        if (b.y < -40) {
          b.elBlock.remove(); b.elHole.remove();
          blocks.splice(i, 1);
          continue;
        }

        const platformTop = b.y;
        const platformBottom = b.y + 18;

        const holeLeft = b.holeX;
        const holeRight = b.holeX + b.width;

        const fullyInHole = (ballLeft >= holeLeft && ballRight <= holeRight);

        const overlapsVertically = (ballBottom > platformTop && ballTop < platformBottom);

        if (overlapsVertically && !fullyInHole) {
          supported = true;
          ball.y = platformTop - (ball.r * 2); // snap
        }

        // score quand tu passes le niveau
        const midY = ball.y + ball.r;
        if (!b.scored && fullyInHole && midY >= platformTop && midY <= platformBottom) {
          b.scored = true;
          score++;
          setHUD("Hole Escape", score, best);
        }
      }

      // vertical
      if (!supported) {
        ball.y += physics.gravity * (dt / 16);
      } else {
        ball.y -= physics.lift * (dt / 16);
      }

      // bounds
      if (ball.y < -20) return gameOver();
      if (ball.y > H() - 22) ball.y = H() - 22;

      // render
      character.style.left = `${ball.x}px`;
      character.style.top = `${ball.y}px`;

      requestAnimationFrame(loop);
    }

    // input
    function onKeyDown(e) {
      if (e.key === "ArrowLeft") leftDown = true;
      if (e.key === "ArrowRight") rightDown = true;
    }
    function onKeyUp(e) {
      if (e.key === "ArrowLeft") leftDown = false;
      if (e.key === "ArrowRight") rightDown = false;
    }

    game.addEventListener("pointerdown", (e) => {
      if (currentGame !== "hole") return;
      if (overlay.classList.contains("show")) return;
      pointerActive = true;
      lastX = e.clientX;
      game.setPointerCapture(e.pointerId);
    });
    game.addEventListener("pointermove", (e) => {
      if (currentGame !== "hole") return;
      if (!pointerActive) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      ball.x = clamp(ball.x + dx, 0, W() - ball.r * 2);
    });
    game.addEventListener("pointerup", () => { if (currentGame === "hole") pointerActive = false; });

    return {
      controls: "← → (ou glisser sur mobile)",
      start() {
        reset();
        running = true;
        setOverlay(false);

        for (let i = 0; i < 6; i++) {
          spawnBlock(H() - 120 - i * 110);
        }
        requestAnimationFrame(loop);
      },
      pause() { },
      resume() { requestAnimationFrame(loop); },
      onKeyDown, onKeyUp
    };
  }

  // =========================
  // ====== GAME 2: FLAPPY BALL
  // =========================
  function makeFlappyBall() {
    const bestKey = "best_flappy";
    let best = Number(localStorage.getItem(bestKey) || 0);

    const ball = { x: 110, y: 200, r: 11, vy: 0 };
    const g = 0.38;
    const jump = -7.6;

    let pipes = []; // {x, gapY, gapH, passed, els:[...]}
    let running = false;
    let score = 0;

    let spawnEvery = 1200;
    let pipeSpeed = 2.3;
    let lastSpawn = 0;
    let lastT = 0;

    function reset() {
      [...game.querySelectorAll(".pipe")].forEach(el => el.remove());
      pipes = [];
      score = 0;
      lastSpawn = 0;
      lastT = 0;

      spawnEvery = 1200;
      pipeSpeed = 2.3;

      ball.x = 110;
      ball.y = H() / 2;
      ball.vy = 0;

      character.style.left = `${ball.x}px`;
      character.style.top = `${ball.y}px`;
      setHUD("Flappy Ball", score, best);
    }

    function spawnPipe() {
      const gapH = 140; // trou vertical
      const padding = 70;
      const gapY = Math.floor(padding + Math.random() * (H() - padding * 2 - gapH));
      const x = W() + 30;

      // top pipe
      const top = document.createElement("div");
      top.className = "pipe";
      top.style.left = `${x}px`;
      top.style.top = `0px`;
      top.style.height = `${gapY}px`;

      // bottom pipe
      const bottom = document.createElement("div");
      bottom.className = "pipe";
      bottom.style.left = `${x}px`;
      bottom.style.top = `${gapY + gapH}px`;
      bottom.style.height = `${H() - (gapY + gapH)}px`;

      game.appendChild(top);
      game.appendChild(bottom);

      pipes.push({ x, gapY, gapH, passed: false, els: [top, bottom] });
    }

    function hitPipe(p) {
      const ballLeft = ball.x;
      const ballRight = ball.x + ball.r * 2;
      const ballTop = ball.y;
      const ballBottom = ball.y + ball.r * 2;

      const pipeLeft = p.x;
      const pipeRight = p.x + 56;

      const overlapX = ballRight > pipeLeft && ballLeft < pipeRight;
      if (!overlapX) return false;

      // si overlapX, collision si balle est hors gap vertical
      const gapTop = p.gapY;
      const gapBottom = p.gapY + p.gapH;

      const insideGap = (ballTop >= gapTop && ballBottom <= gapBottom);
      return !insideGap;
    }

    function gameOver() {
      running = false;
      if (score > best) {
        best = score;
        localStorage.setItem(bestKey, String(best));
      }
      overlayTitle.textContent = "Game Over";
      overlayText.textContent = `Flappy Ball • Score: ${score} • Best: ${best}`;
      controlsHint.textContent = "Espace / clic / tap = jump";
      setOverlay(true);
      setHUD("Flappy Ball", score, best);
    }

    function doJump() {
      if (!running || paused) return;
      ball.vy = jump;
    }

    function loop(t) {
      if (!running || paused) return;
      if (!lastT) lastT = t;
      const dt = Math.min(32, t - lastT);
      lastT = t;

      // physics
      ball.vy += g * (dt / 16);
      ball.y += ball.vy * (dt / 16);

      // spawn pipes
      lastSpawn += dt;
      if (lastSpawn >= spawnEvery) {
        lastSpawn = 0;
        spawnPipe();

        // difficulté
        pipeSpeed += 0.05;
        spawnEvery = Math.max(900, spawnEvery - 10);
      }

      // move pipes + collisions + score
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= pipeSpeed * (dt / 16);

        p.els[0].style.left = `${p.x}px`;
        p.els[1].style.left = `${p.x}px`;

        if (p.x < -80) {
          p.els[0].remove(); p.els[1].remove();
          pipes.splice(i, 1);
          continue;
        }

        // score quand on passe le pipe
        if (!p.passed && p.x + 56 < ball.x) {
          p.passed = true;
          score++;
          setHUD("Flappy Ball", score, best);
        }

        if (hitPipe(p)) return gameOver();
      }

      // bounds
      if (ball.y < -10 || ball.y > H() - 22) return gameOver();

      // render
      character.style.left = `${ball.x}px`;
      character.style.top = `${ball.y}px`;

      requestAnimationFrame(loop);
    }

    // controls
    function onKeyDown(e) {
      if (e.code === "Space") { e.preventDefault(); doJump(); }
    }

    // click/tap
    game.addEventListener("pointerdown", (e) => {
      if (currentGame !== "flappy") return;
      if (overlay.classList.contains("show")) return;
      doJump();
    });

    return {
      controls: "Espace / clic / tap = jump",
      start() {
        reset();
        running = true;
        setOverlay(false);
        requestAnimationFrame(loop);
      },
      pause() { },
      resume() { requestAnimationFrame(loop); },
      onKeyDown
    };
  }

  // Init
  btnPause.disabled = false;
  showMenu();


  function makeSnake() {
    const bestKey = "best_snake";
    let best = Number(localStorage.getItem(bestKey) || 0);

    let running = false;
    let score = 0;

    const cell = 18;                 // taille case
    const cols = () => Math.floor(W() / cell);
    const rows = () => Math.floor(H() / cell);

    let snake = [];                  // [{x,y}]
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let food = { x: 5, y: 5 };

    let lastStep = 0;
    let stepEvery = 120;             // ms (plus petit = plus rapide)

    // petit rendu en divs (simple)
    let parts = [];
    let foodEl = null;

    function cleanup() {
      parts.forEach(p => p.remove());
      parts = [];
      if (foodEl) foodEl.remove();
      foodEl = null;
    }

    function randCell(max) {
      return Math.floor(Math.random() * max);
    }

    function placeFood() {
      const C = cols(), R = rows();
      for (let tries = 0; tries < 200; tries++) {
        const fx = randCell(C);
        const fy = randCell(R);
        const onSnake = snake.some(s => s.x === fx && s.y === fy);
        if (!onSnake) {
          food = { x: fx, y: fy };
          if (!foodEl) {
            foodEl = document.createElement("div");
            foodEl.style.position = "absolute";
            foodEl.style.width = `${cell - 4}px`;
            foodEl.style.height = `${cell - 4}px`;
            foodEl.style.borderRadius = "10px";
            foodEl.style.background = "rgba(56,189,248,.95)";
            foodEl.style.boxShadow = "0 10px 30px rgba(56,189,248,.25)";
            foodEl.style.zIndex = "4";
            game.appendChild(foodEl);
          }
          foodEl.style.left = `${food.x * cell + 2}px`;
          foodEl.style.top = `${food.y * cell + 2}px`;
          return;
        }
      }
    }

    function render() {
      // snake
      while (parts.length < snake.length) {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.width = `${cell - 4}px`;
        el.style.height = `${cell - 4}px`;
        el.style.borderRadius = "10px";
        el.style.background = "rgba(233,240,255,.18)";
        el.style.border = "1px solid rgba(255,255,255,.12)";
        el.style.zIndex = "4";
        game.appendChild(el);
        parts.push(el);
      }
      while (parts.length > snake.length) {
        parts.pop().remove();
      }

      for (let i = 0; i < snake.length; i++) {
        const s = snake[i];
        parts[i].style.left = `${s.x * cell + 2}px`;
        parts[i].style.top = `${s.y * cell + 2}px`;
        // tête un peu plus visible
        parts[i].style.background = (i === 0)
          ? "rgba(251,113,133,.95)"
          : "rgba(233,240,255,.16)";
      }

      // cacher la balle du jeu précédent
      character.style.display = "none";
    }

    function gameOver() {
      running = false;
      if (score > best) {
        best = score;
        localStorage.setItem(bestKey, String(best));
      }
      overlayTitle.textContent = "Game Over";
      overlayText.textContent = `Snake • Score: ${score} • Best: ${best}`;
      controlsHint.textContent = "↑ ↓ ← → (ou swipe mobile)";
      setOverlay(true);
      setHUD("Snake", score, best);
    }

    function step() {
      // appliquer direction (empêche demi-tour)
      dir = nextDir;

      const head = snake[0];
      const nx = head.x + dir.x;
      const ny = head.y + dir.y;

      // murs
      if (nx < 0 || ny < 0 || nx >= cols() || ny >= rows()) return gameOver();

      // collision corps
      if (snake.some((s, idx) => idx !== 0 && s.x === nx && s.y === ny)) return gameOver();

      // avancer
      snake.unshift({ x: nx, y: ny });

      // manger
      if (nx === food.x && ny === food.y) {
        score++;
        setHUD("Snake", score, best);

        // accélère un peu
        stepEvery = Math.max(70, stepEvery - 2);

        placeFood();
      } else {
        snake.pop();
      }

      render();
    }

    function loop(t) {
      if (!running || paused) return;

      if (!lastStep) lastStep = t;
      const dt = t - lastStep;

      if (dt >= stepEvery) {
        lastStep = t;
        step();
      }
      requestAnimationFrame(loop);
    }

    // controls clavier
    function onKeyDown(e) {
      const k = e.key;
      if (k === "ArrowUp" && dir.y !== 1) nextDir = { x: 0, y: -1 };
      if (k === "ArrowDown" && dir.y !== -1) nextDir = { x: 0, y: 1 };
      if (k === "ArrowLeft" && dir.x !== 1) nextDir = { x: -1, y: 0 };
      if (k === "ArrowRight" && dir.x !== -1) nextDir = { x: 1, y: 0 };
    }

    // swipe mobile simple
    let touchStart = null;
    const onPointerDown = (e) => {
      if (currentGame !== "snake") return;
      if (overlay.classList.contains("show")) return;
      touchStart = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e) => {
      if (currentGame !== "snake") return;
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      touchStart = null;

      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && dir.x !== -1) nextDir = { x: 1, y: 0 };
        if (dx < 0 && dir.x !== 1) nextDir = { x: -1, y: 0 };
      } else {
        if (dy > 0 && dir.y !== -1) nextDir = { x: 0, y: 1 };
        if (dy < 0 && dir.y !== 1) nextDir = { x: 0, y: -1 };
      }
    };

    return {
      controls: "↑ ↓ ← → (ou swipe mobile)",
      start() {
        cleanup();
        running = true;
        score = 0;
        stepEvery = 120;
        setHUD("Snake", score, best);
        setOverlay(false);

        // init snake
        const startX = Math.floor(cols() / 2);
        const startY = Math.floor(rows() / 2);
        snake = [{ x: startX, y: startY }, { x: startX - 1, y: startY }, { x: startX - 2, y: startY }];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };

        placeFood();
        render();

        // events mobile (safe)
        game.removeEventListener("pointerdown", onPointerDown);
        game.removeEventListener("pointerup", onPointerUp);
        game.addEventListener("pointerdown", onPointerDown);
        game.addEventListener("pointerup", onPointerUp);

        lastStep = 0;
        requestAnimationFrame(loop);
      },
      pause() { },
      resume() { requestAnimationFrame(loop); },
      onKeyDown
    };
  }
});