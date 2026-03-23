(function() {
    const oldWrap = document.getElementById("game-wrap");
    if (oldWrap) oldWrap.remove();

    const gameHTML = `
    <div id="game-wrap" style="position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999; background:#000; overflow:hidden; cursor:crosshair;">
        <canvas id="gameCanvas"></canvas>
        <div id="ui-layer" style="position:absolute; top:30px; left:30px; color:#fff; pointer-events:none; font-family:sans-serif;">
            <div id="score-board" style="font-size:2.2rem; font-weight:bold; color:#00dbde;">SURVIVAL: <span id="score">0.0</span>s</div>
            <div id="life-counter" style="font-size:1.8rem; color:#ff4757; margin-top:5px;">LIFE: ♥♥♥♥</div>
            <div id="pattern-status" style="font-size:1rem; color:#ffeb3b; margin-top:5px; opacity:0.8;">LASER STABILIZED</div>
        </div>
        <div id="hit-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(255,0,0,0.3); display:none; pointer-events:none;"></div>
        <div id="game-over" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); display:none; flex-direction:column; justify-content:center; align-items:center; color:#fff; font-family:sans-serif;">
            <h1 style="font-size:3rem; color:#ff0000;">TERMINATED</h1>
            <p id="final-score" style="font-size:2rem; margin: 15px 0;"></p>
            <button id="retryBtn" style="padding:15px 50px; font-weight:bold; cursor:pointer; background:#00dbde; border:none; border-radius:30px; color:#000;">다시 시작</button>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('afterbegin', gameHTML);

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const lifeEl = document.getElementById("life-counter");
    const statusEl = document.getElementById("pattern-status");
    const hitOverlay = document.getElementById("hit-overlay");
    const gameOverEl = document.getElementById("game-over");

    let canvasW, canvasH, player, enemies, animationId, score, startTime, keys = {}, lastPatternTime = 0;
    let laser = { angle: Math.PI, width: 12 }; // 두께 22에서 12로 최적화

    function init() {
        canvasW = canvas.width = window.innerWidth;
        canvasH = canvas.height = window.innerHeight;
        player = { 
            x: canvasW / 2, y: canvasH / 2, size: 10, speed: 8.5, color: "#00dbde", 
            life: 4, invulUntil: Date.now() + 1500 
        };
        enemies = [];
        score = 0;
        startTime = Date.now();
        lastPatternTime = Date.now();
        laser.angle = Math.PI;
        updateLifeUI();
        gameOverEl.style.display = "none";
        loop();
    }

    function updateLifeUI() {
        lifeEl.innerText = "LIFE: " + "♥".repeat(Math.max(0, player.life));
    }

    function takeDamage() {
        if (Date.now() < player.invulUntil) return;
        player.life--;
        player.invulUntil = Date.now() + 1500;
        updateLifeUI();
        hitOverlay.style.display = "block";
        setTimeout(() => hitOverlay.style.display = "none", 150);
        if (player.life <= 0) endGame();
    }

    function spawnPattern() {
        const types = ['burst', 'homing', 'cross', 'spiral', 'sweep', 'bounce', 'wave', 'blackhole', 'vshape', 'rain', 'zigzag', 'sniper', 'flower', 'chaos'];
        const type = types[Math.floor(Math.random() * types.length)];
        const px = player.x, py = player.y;

        switch(type) {
            case 'burst': for(let i=0; i<8; i++){ const a=(Math.PI*2/8)*i; enemies.push({x:canvasW/2, y:canvasH/2, vx:Math.cos(a)*5, vy:Math.sin(a)*5, size:6, color:"#fc00ff"}); } break;
            case 'homing': const ha=Math.atan2(py-0, px-0); enemies.push({x:0, y:0, vx:Math.cos(ha)*8, vy:Math.sin(ha)*8, size:11, color:"#ffeb3b"}); break;
            case 'cross': for(let i=0; i<6; i++){ enemies.push({x:canvasW*(i/6), y:0, vx:0, vy:5, size:6, color:"#ff4444"}); enemies.push({x:0, y:canvasH*(i/6), vx:5, vy:0, size:6, color:"#ff4444"}); } break;
            case 'spiral': for(let i=0; i<4; i++){ const a=(Date.now()*0.01)+(i*Math.PI*2/4); enemies.push({x:canvasW/2, y:canvasH/2, vx:Math.cos(a)*4, vy:Math.sin(a)*4, size:5, color:"#00ff00"}); } break;
            case 'sweep': const left=Math.random()>0.5; for(let i=0; i<5; i++) enemies.push({x:left?0:canvasW, y:canvasH*(i/5), vx:left?6:-6, vy:0, size:8, color:"#4444ff"}); break;
            case 'bounce': enemies.push({x:Math.random()*canvasW, y:0, vx:5, vy:5, size:10, color:"#fff", b:2}); break;
            case 'wave': for(let i=0; i<8; i++) enemies.push({x:canvasW*(i/8), y:-20, vx:0, vy:4, size:5, color:"#03a9f4", wave:true, off:i}); break;
            case 'blackhole': const bx=Math.random()*canvasW, by=Math.random()*canvasH; for(let i=0; i<8; i++){ const a=(Math.PI*2/8)*i; enemies.push({x:bx+Math.cos(a)*200, y:by+Math.sin(a)*200, vx:-Math.cos(a)*4, vy:-Math.sin(a)*4, size:6, color:"#9c27b0"}); } break;
            case 'vshape': const va=Math.atan2(py-0, px-canvasW/2); enemies.push({x:canvasW/2, y:0, vx:Math.cos(va-0.2)*7, vy:Math.sin(va-0.2)*7, size:8, color:"#ff5722"}); enemies.push({x:canvasW/2, y:0, vx:Math.cos(va+0.2)*7, vy:Math.sin(va+0.2)*7, size:8, color:"#ff5722"}); break;
            case 'rain': for(let i=0; i<10; i++) enemies.push({x:Math.random()*canvasW, y:-50, vx:0, vy:Math.random()*5+3, size:4, color:"#607d8b"}); break;
            case 'zigzag': enemies.push({x:0, y:0, vx:7, vy:5, size:10, color:"#e91e63", b:3}); break;
            case 'sniper': if(Math.random()>0.5) for(let i=0; i<12; i++) enemies.push({x:canvasW*(i/12), y:py-10, vx:0, vy:12, size:5, color:"#f44336"}); break;
            case 'flower': const fa=Date.now()*0.003; for(let i=0; i<6; i++){ const a=fa+(i*Math.PI*2/6); enemies.push({x:canvasW/2, y:canvasH/2, vx:Math.cos(a)*2.5, vy:Math.sin(a)*2.5, size:6, color:"#ffeb3b", flow:true}); } break;
            case 'chaos': for(let i=0; i<6; i++) enemies.push({x:Math.random()*canvasW, y:Math.random()*canvasH, vx:Math.random()*12-6, vy:Math.random()*12-6, size:5, color:"#ffffff"}); break;
        }
    }

    function loop() {
        animationId = requestAnimationFrame(loop);
        ctx.fillStyle = "rgba(5, 5, 10, 0.4)";
        ctx.fillRect(0, 0, canvasW, canvasH);

        const now = Date.now(), elapsed = now - startTime;
        const isInvul = now < player.invulUntil;

        if(keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed;
        if(keys['ArrowDown'] || keys['KeyS']) player.y += player.speed;
        if(keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
        if(keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
        player.x = Math.max(10, Math.min(canvasW-10, player.x));
        player.y = Math.max(10, Math.min(canvasH-10, player.y));

        if (!isInvul || Math.floor(now/100)%2===0) {
            ctx.fillStyle = isInvul ? "#fff" : player.color;
            ctx.fillRect(player.x-6, player.y-6, 12, 12);
        }

        const maxAllowed = Math.min(3, Math.floor(elapsed / 5000) + 1);

        if(elapsed > 1500 && now - lastPatternTime > 800) {
            for(let i=0; i < maxAllowed; i++) spawnPattern();
            lastPatternTime = now;
        }

        // --- 레이저 (두께 최적화) ---
        let da = Math.atan2(player.y-canvasH/2, player.x-canvasW/2) - laser.angle;
        while(da < -Math.PI) da += Math.PI*2; while(da > Math.PI) da -= Math.PI*2;
        laser.angle += da * 0.02;

        const lx = canvasW/2, ly = canvasH/2;
        const tx = lx + Math.cos(laser.angle) * 3000, ty = ly + Math.sin(laser.angle) * 3000;

        ctx.strokeStyle = "rgba(252, 0, 255, 0.3)";
        ctx.lineWidth = laser.width + 6;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke();
        
        ctx.strokeStyle = "#fc00ff";
        ctx.lineWidth = laser.width;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke();
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = laser.width / 4;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke();

        const lDist = Math.abs(Math.sin(laser.angle)*(player.x-lx)-Math.cos(laser.angle)*(player.y-ly));
        if(!isInvul && lDist < (laser.width / 2 + 4)) takeDamage();

        for(let i = enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            if(e.wave) { e.x += Math.sin(now*0.01 + e.off); e.y += e.vy; }
            else { e.x += e.vx; e.y += e.vy; }
            if(e.b && (e.x<0 || e.x>canvasW)) { e.vx*=-1; e.b--; }
            if(e.b && (e.y<0 || e.y>canvasH)) { e.vy*=-1; e.b--; }
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill();
            if(!isInvul && Math.hypot(player.x-e.x, player.y-e.y) < 11) takeDamage();
            if(e.x<-200 || e.x>canvasW+200 || e.y<-200 || e.y>canvasH+200) enemies.splice(i, 1);
        }

        score = Math.floor(elapsed/100);
        scoreEl.innerText = (score/10).toFixed(1);
    }

    function endGame() {
        cancelAnimationFrame(animationId);
        gameOverEl.style.display = "flex";
        document.getElementById("final-score").innerText = `최종 생존 시간: ${(score/10).toFixed(1)}s`;
    }

    window.onkeydown = (e) => keys[e.code] = true;
    window.onkeyup = (e) => keys[e.code] = false;
    document.getElementById("retryBtn").onclick = init;
    init();
})();