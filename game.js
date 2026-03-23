// ===== ESCAPE OBSESSION - Bullet Hell Survival =====
(function() {
    'use strict';

    // ===== DOM ELEMENTS =====
    const titleScreen = document.getElementById('title-screen');
    const gameWrap = document.getElementById('game-wrap');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const lifeHeartsEl = document.getElementById('life-hearts');
    const statusEl = document.getElementById('pattern-status');
    const hitOverlay = document.getElementById('hit-overlay');
    const warningFlash = document.getElementById('warning-flash');
    const gameOverEl = document.getElementById('game-over');
    const diffFill = document.getElementById('diff-fill');
    const bestScoreVal = document.getElementById('best-score-val');
    const dashFill = document.getElementById('dash-fill');
    const pauseOverlay = document.getElementById('pause-overlay');

    // ===== GAME STATE =====
    let canvasW, canvasH;
    let player, enemies, particles, shockwaves;
    let animationId, score, startTime;
    let keys = {};
    let lastPatternTime = 0;
    let laser = { angle: Math.PI, width: 12, targetWidth: 12 };
    
    // Separate best scores
    let bestScoreNormal = parseFloat(localStorage.getItem('escapeObsession_best_normal') || '0');
    let bestScoreHard = parseFloat(localStorage.getItem('escapeObsession_best_hard') || '0');
    
    let gameRunning = false;
    let isHardMode = false;
    let isPaused = false;
    let pauseStartTime = 0;
    let screenShakeTime = 0;
    let bgStars = [];
    let statusMessages = [
        'LASER STABILIZED', 'PATTERN INCOMING', 'THREAT DETECTED',
        'DANGER LEVEL UP', 'CHAOS MODE', 'EVASION CRITICAL',
        'SYSTEMS OVERLOADING', 'MAXIMUM THREAT'
    ];

    // ===== INITIALIZATION =====
    function initCanvas() {
        canvasW = canvas.width = window.innerWidth;
        canvasH = canvas.height = window.innerHeight;
    }

    function createBgStars() {
        bgStars = [];
        for (let i = 0; i < 150; i++) {
            bgStars.push({ x: Math.random()*canvasW, y: Math.random()*canvasH, size: Math.random()*0.6+0.1, speed: Math.random()*0.15+0.05, brightness: Math.random()*0.5+0.2, layer: 1 });
        }
        for (let i = 0; i < 60; i++) {
            bgStars.push({ x: Math.random()*canvasW, y: Math.random()*canvasH, size: Math.random()*1.0+0.5, speed: Math.random()*0.4+0.2, brightness: Math.random()*0.7+0.3, layer: 2 });
        }
        for (let i = 0; i < 20; i++) {
            bgStars.push({ x: Math.random()*canvasW, y: Math.random()*canvasH, size: Math.random()*1.2+0.6, speed: Math.random()*1.2+0.8, brightness: Math.random()*0.4+0.1, color: `hsl(${Math.random()*360}, 10%, 65%)`, layer: 3 });
        }
    }

    function createHearts() {
        lifeHeartsEl.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.id = `heart-${i}`;
            heart.innerHTML = `<svg viewBox="0 0 24 24" fill="#ff4757"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
            lifeHeartsEl.appendChild(heart);
        }
    }

    function updateBestDisplay() {
        const bnStr = (bestScoreNormal / 10).toFixed(1);
        const bhStr = (bestScoreHard / 10).toFixed(1);
        bestScoreVal.textContent = isHardMode ? bhStr : bnStr;
        
        const tbn = document.getElementById('title-best-normal');
        if (tbn) tbn.textContent = bnStr;
        const tbh = document.getElementById('title-best-hard');
        if (tbh) tbh.textContent = bhStr;
    }

    // ===== PARTICLE SYSTEM =====
    function spawnParticles(x, y, count, color, isGeometric = false) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12,
                life: 1.0, decay: Math.random()*0.02+0.02,
                size: Math.random()*4+2,
                color: color || '#00dbde',
                isGeometric,
                shape: isGeometric ? ['triangle','line','square'][Math.floor(Math.random()*3)] : 'circle',
                angle: Math.random()*Math.PI*2,
                vAngle: (Math.random()-0.5)*0.4
            });
        }
    }

    function spawnShockwave(x, y, color) {
        shockwaves.push({ x, y, radius: 5, maxRadius: 80, life: 1, color });
    }

    function drawParticles() {
        for (let i = particles.length-1; i >= 0; i--) {
            const p = particles[i];
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            if (p.isGeometric) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.beginPath();
                if (p.shape === 'triangle') { ctx.moveTo(p.size,0); ctx.lineTo(-p.size,p.size); ctx.lineTo(-p.size,-p.size); }
                else if (p.shape === 'square') { ctx.rect(-p.size,-p.size,p.size*2,p.size*2); }
                else if (p.shape === 'line') { ctx.rect(-p.size*2,-p.size/3,p.size*4,p.size/1.5); }
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
            }
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.95; p.vy *= 0.95;
            if (p.angle !== undefined) p.angle += p.vAngle;
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
        ctx.globalAlpha = 1;
    }

    function updateShockwaves() {
        for (let i = shockwaves.length-1; i >= 0; i--) {
            const s = shockwaves[i];
            s.radius += (s.maxRadius - s.radius) * 0.15;
            s.life -= 0.04;
            if (s.life <= 0) { shockwaves.splice(i, 1); continue; }
            ctx.globalAlpha = s.life * 0.4;
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ===== PLAYER =====
    function updateLifeUI() {
        for (let i = 0; i < 4; i++) {
            const heart = document.getElementById(`heart-${i}`);
            if (!heart) continue;
            if (i >= player.life) heart.classList.add('lost');
            else heart.classList.remove('lost');
        }
    }

    function takeDamage() {
        if (Date.now() < player.invulUntil) return;
        player.life--;
        player.invulUntil = Date.now() + 1500;
        updateLifeUI();
        hitOverlay.classList.add('active');
        setTimeout(() => hitOverlay.classList.remove('active'), 200);
        gameWrap.classList.add('screen-shake');
        setTimeout(() => gameWrap.classList.remove('screen-shake'), 150);
        canvas.classList.add('glitch-effect');
        setTimeout(() => canvas.classList.remove('glitch-effect'), 300);
        const lostHeart = document.getElementById(`heart-${player.life}`);
        if (lostHeart) { lostHeart.classList.add('hit'); setTimeout(() => lostHeart.classList.remove('hit'), 300); }
        spawnParticles(player.x, player.y, 20, '#ff4757', true);
        spawnShockwave(player.x, player.y, '#ff4757');
        if (player.life <= 1) warningFlash.classList.add('active');
        if (player.life <= 0) endGame();
    }

    // ===== ENEMY PATTERNS =====
    function spawnPattern() {
        const MAX_ENEMIES = isHardMode ? 70 : 57;
        if (enemies.length >= MAX_ENEMIES) return;

        let types = [
            'burst','homing','cross','spiral','sweep','bounce','wave','blackhole',
            'vshape','rain','zigzag','sniper','flower','chaos','swarm','laser_grid',
            'mines','pincer','sine_wave','spinner',
            'snake','crossfire','pulse_ring','wall','triangle_net','spiral_reverse',
            'starburst','twin_laser','orbit_player','random_bombs'
        ];
        
        if (isHardMode) {
            types.push('gravity_field','wind','fog');
        }

        let type = types[Math.floor(Math.random()*types.length)];
        
        // Prevent hazards from overlapping
        if (['gravity_field', 'wind', 'fog'].includes(type)) {
            const hazardExists = enemies.some(e => e.isHazard);
            if (hazardExists) {
                type = types[Math.floor(Math.random() * (types.length - 3))]; // Reroll to normal pattern
            }
        }

        const px = player.x, py = player.y;
        const now = Date.now();
        const preLen = enemies.length;
        const elapsed = now - startTime;
        const msgIdx = Math.min(Math.floor(elapsed/8000), statusMessages.length-1);
        statusEl.textContent = statusMessages[msgIdx];

        switch(type) {
            case 'burst':
                for(let i=0;i<8;i++){const a=(Math.PI*2/8)*i; enemies.push({x:canvasW/2,y:canvasH/2,vx:Math.cos(a)*5,vy:Math.sin(a)*5,size:6,color:'#fc00ff',glow:'rgba(252,0,255,0.4)',shape:'square'});}
                break;
            case 'homing':
                const ha=Math.atan2(py,px);
                enemies.push({x:0,y:0,vx:Math.cos(ha)*8,vy:Math.sin(ha)*8,size:11,color:'#ffeb3b',glow:'rgba(255,235,59,0.4)',trail:true,shape:'triangle',angle:ha});
                break;
            case 'cross':
                for(let i=0;i<6;i++){enemies.push({x:canvasW*(i/6),y:0,vx:0,vy:5,size:6,color:'#ff4444',glow:'rgba(255,68,68,0.3)',shape:'cross'});enemies.push({x:0,y:canvasH*(i/6),vx:5,vy:0,size:6,color:'#ff4444',glow:'rgba(255,68,68,0.3)',shape:'cross'});}
                break;
            case 'spiral':
                for(let i=0;i<4;i++){const a=(Date.now()*0.01)+(i*Math.PI*2/4); enemies.push({x:canvasW/2,y:canvasH/2,vx:Math.cos(a)*4,vy:Math.sin(a)*4,size:5,color:'#00ff41',glow:'rgba(0,255,65,0.4)',shape:'circle'});}
                break;
            case 'sweep':
                const left=Math.random()>0.5;
                for(let i=0;i<5;i++) enemies.push({x:left?0:canvasW,y:canvasH*(i/5),vx:left?6:-6,vy:0,size:8,color:'#4488ff',glow:'rgba(68,136,255,0.3)',shape:'square'});
                break;
            case 'bounce':
                enemies.push({x:Math.random()*canvasW,y:0,vx:5,vy:5,size:10,color:'#ffffff',glow:'rgba(255,255,255,0.3)',b:2,trail:true,shape:'ring'});
                break;
            case 'wave':
                for(let i=0;i<8;i++) enemies.push({x:canvasW*(i/8),y:-20,vx:0,vy:4,size:5,color:'#03a9f4',glow:'rgba(3,169,244,0.3)',wave:true,off:i,shape:'circle'});
                break;
            case 'blackhole':
                const bx=Math.random()*canvasW,by=Math.random()*canvasH;
                for(let i=0;i<8;i++){const a=(Math.PI*2/8)*i; enemies.push({x:bx+Math.cos(a)*200,y:by+Math.sin(a)*200,vx:-Math.cos(a)*4,vy:-Math.sin(a)*4,size:6,color:'#9c27b0',glow:'rgba(156,39,176,0.4)',shape:'triangle',angle:a+Math.PI});}
                break;
            case 'vshape':
                const va=Math.atan2(py,px-canvasW/2);
                enemies.push({x:canvasW/2,y:0,vx:Math.cos(va-0.2)*7,vy:Math.sin(va-0.2)*7,size:8,color:'#ff5722',glow:'rgba(255,87,34,0.4)',shape:'triangle',angle:va-0.2});
                enemies.push({x:canvasW/2,y:0,vx:Math.cos(va+0.2)*7,vy:Math.sin(va+0.2)*7,size:8,color:'#ff5722',glow:'rgba(255,87,34,0.4)',shape:'triangle',angle:va+0.2});
                break;
            case 'rain':
                for(let i=0;i<10;i++) enemies.push({x:Math.random()*canvasW,y:-50,vx:0,vy:Math.random()*5+3,size:4,color:'#607d8b',glow:'rgba(96,125,139,0.3)',shape:'square'});
                break;
            case 'zigzag':
                enemies.push({x:0,y:0,vx:7,vy:5,size:10,color:'#e91e63',glow:'rgba(233,30,99,0.4)',b:3,trail:true,shape:'cross'});
                break;
            case 'sniper':
                if(Math.random()>0.5) for(let i=0;i<12;i++) enemies.push({x:canvasW*(i/12),y:py-10,vx:0,vy:12,size:5,color:'#f44336',glow:'rgba(244,67,54,0.4)',shape:'circle'});
                break;
            case 'flower':
                const fa=Date.now()*0.003;
                for(let i=0;i<6;i++){const a=fa+(i*Math.PI*2/6); enemies.push({x:canvasW/2,y:canvasH/2,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,size:6,color:'#ffeb3b',glow:'rgba(255,235,59,0.4)',flow:true,shape:'ring'});}
                break;
            case 'chaos':
                for(let i=0;i<6;i++) enemies.push({x:Math.random()*canvasW,y:Math.random()*canvasH,vx:Math.random()*12-6,vy:Math.random()*12-6,size:5,color:'#ffffff',glow:'rgba(255,255,255,0.3)',shape:'square'});
                break;
            case 'swarm':
                for(let i=0;i<15;i++){const ang=Math.random()*Math.PI*2;const dx=Math.cos(ang)*canvasW*0.5,dy=Math.sin(ang)*canvasH*0.5;const tA=Math.atan2(py-(py+dy),px-(px+dx));enemies.push({x:px+dx,y:py+dy,vx:Math.cos(tA)*(Math.random()*2+3),vy:Math.sin(tA)*(Math.random()*2+3),size:4,color:'#fdd835',glow:'rgba(253,216,53,0.4)',shape:'triangle',angle:tA});}
                break;
            case 'laser_grid':
                if(Math.random()>0.5){for(let i=1;i<10;i++) enemies.push({x:-20,y:canvasH*(i/10),vx:4,vy:0,size:5,color:'#00bcd4',glow:'rgba(0,188,212,0.4)',shape:'square'});}
                else{for(let i=1;i<10;i++) enemies.push({x:canvasW*(i/10),y:-20,vx:0,vy:4,size:5,color:'#00bcd4',glow:'rgba(0,188,212,0.4)',shape:'square'});}
                break;
            case 'mines':
                for(let i=0;i<4;i++){const ex=Math.random()*canvasW,ey=Math.random()*canvasH;if(Math.hypot(ex-px,ey-py)>150) enemies.push({x:ex,y:ey,vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.5,size:14,color:'#ff9800',glow:'rgba(255,152,0,0.5)',shape:'ring',b:5});}
                break;
            case 'pincer':
                for(let i=0;i<5;i++){enemies.push({x:-20,y:canvasH*0.3+(i*40),vx:6,vy:0,size:7,color:'#e040fb',glow:'rgba(224,64,251,0.4)',shape:'triangle',angle:0});enemies.push({x:canvasW+20,y:canvasH*0.7-(i*40),vx:-6,vy:0,size:7,color:'#e040fb',glow:'rgba(224,64,251,0.4)',shape:'triangle',angle:Math.PI});}
                break;
            case 'sine_wave':
                for(let i=0;i<8;i++) enemies.push({x:canvasW+i*40,y:canvasH/2,vx:-5,vy:0,size:5,color:'#1de9b6',glow:'rgba(29,233,182,0.4)',shape:'circle',sine:true,baseY:Math.random()*canvasH*0.8+canvasH*0.1,off:i*0.5});
                break;
            case 'spinner':
                for(let i=0;i<6;i++) enemies.push({x:canvasW/2,y:canvasH/2,vx:0,vy:0,size:8,color:'#ff1744',glow:'rgba(255,23,68,0.4)',trail:true,shape:'cross',spinner:true,ang:i*(Math.PI*2/6),rad:10});
                break;
            case 'snake':
                for(let i=0;i<12;i++) enemies.push({x:-i*30,y:canvasH/3,vx:5,vy:0,size:6,color:'#00e676',glow:'rgba(0,230,118,0.4)',shape:'circle',wave:true,off:i*0.2});
                break;
            case 'crossfire':
                if(Math.random()>0.5){for(let i=0;i<6;i++){enemies.push({x:i*40-100,y:i*40-100,vx:4,vy:4,size:5,color:'#ff6e40',glow:'rgba(255,110,64,0.4)',shape:'square'});enemies.push({x:canvasW-(i*40-100),y:canvasH-(i*40-100),vx:-4,vy:-4,size:5,color:'#ff6e40',glow:'rgba(255,110,64,0.4)',shape:'square'});}}
                else{for(let i=0;i<6;i++){enemies.push({x:i*40-100,y:canvasH-(i*40-100),vx:4,vy:-4,size:5,color:'#ff6e40',glow:'rgba(255,110,64,0.4)',shape:'square'});enemies.push({x:canvasW-(i*40-100),y:i*40-100,vx:-4,vy:4,size:5,color:'#ff6e40',glow:'rgba(255,110,64,0.4)',shape:'square'});}}
                break;
            case 'pulse_ring':
                for(let i=0;i<12;i++){const a=(Math.PI*2/12)*i; enemies.push({x:canvasW/2,y:canvasH/2,vx:0,vy:0,size:7,color:'#d500f9',glow:'rgba(213,0,249,0.4)',shape:'ring',pulsar:true,ang:a,rad:0});}
                break;
            case 'wall':
                const gap=Math.floor(Math.random()*8);
                for(let i=0;i<12;i++){if(Math.abs(i-gap)<2) continue; enemies.push({x:canvasW*(i/12),y:-20,vx:0,vy:3,size:8,color:'#ffea00',glow:'rgba(255,234,0,0.4)',shape:'square'});}
                break;
            case 'triangle_net':
                for(let i=0;i<3;i++){const a=(Math.PI*2/3)*i; enemies.push({x:px+Math.cos(a)*500,y:py+Math.sin(a)*500,vx:-Math.cos(a)*2.5,vy:-Math.sin(a)*2.5,size:12,color:'#f50057',glow:'rgba(245,0,87,0.4)',shape:'triangle',angle:a+Math.PI});}
                break;
            case 'spiral_reverse':
                for(let i=0;i<6;i++){const a=(now*-0.01)+(i*Math.PI*2/6); enemies.push({x:canvasW/2,y:canvasH/2,vx:Math.cos(a)*4,vy:Math.sin(a)*4,size:5,color:'#00b0ff',glow:'rgba(0,176,255,0.4)',shape:'circle'});}
                break;
            case 'starburst':
                const sx=px+(Math.random()-0.5)*300,sy=py+(Math.random()-0.5)*300;
                for(let i=0;i<8;i++){const a=(Math.PI*2/8)*i; enemies.push({x:sx,y:sy,vx:Math.cos(a)*6,vy:Math.sin(a)*6,size:4,color:'#76ff03',glow:'rgba(118,255,3,0.4)',shape:'cross'});}
                break;
            case 'twin_laser':
                const side=Math.random()>0.5?1:-1;
                for(let i=0;i<15;i++){enemies.push({x:side>0?-10-i*25:canvasW+10+i*25,y:canvasH*0.25,vx:side*8,vy:0,size:6,color:'#ff3d00',glow:'rgba(255,61,0,0.4)',shape:'square'});enemies.push({x:side>0?-10-i*25:canvasW+10+i*25,y:canvasH*0.75,vx:side*8,vy:0,size:6,color:'#ff3d00',glow:'rgba(255,61,0,0.4)',shape:'square'});}
                break;
            case 'orbit_player':
                for(let i=0;i<5;i++){const a=(Math.PI*2/5)*i; enemies.push({x:px+Math.cos(a)*250,y:py+Math.sin(a)*250,vx:0,vy:0,size:5,color:'#ea80fc',glow:'rgba(234,128,252,0.4)',shape:'circle',orbiter:true,ang:a,rad:250,centerX:px,centerY:py});}
                break;
            case 'random_bombs':
                for(let i=0;i<6;i++) enemies.push({x:Math.random()*canvasW,y:Math.random()*canvasH,vx:(Math.random()-0.5)*1.5,vy:(Math.random()-0.5)*1.5,size:9,color:'#c6ff00',glow:'rgba(198,255,0,0.4)',shape:'ring',b:2});
                break;
            case 'gravity_field':
                enemies.push({x:canvasW/2,y:canvasH/2,vx:0,vy:0,size:0,maxSize:(Math.min(canvasW,canvasH)*0.4),color:'rgba(0,0,0,0)',shape:'gravity',lifespan:6000,isHazard:true});
                break;
            case 'wind':
                const wa=Math.random()*Math.PI*2;
                enemies.push({x:0,y:0,vx:Math.cos(wa)*4,vy:Math.sin(wa)*4,size:0,color:'transparent',shape:'wind',lifespan:6000,isHazard:true,windAngle:wa});
                break;
            case 'fog':
                enemies.push({x:canvasW/2,y:canvasH/2,vx:0,vy:0,size:canvasW,color:'rgba(25,25,35,0.95)',shape:'fog',lifespan:7000,isHazard:true});
                break;
        }

        for(let i=preLen; i<enemies.length; i++){
            enemies[i].spawnTime = now;
            enemies[i].lifespan = 6000;
        }
    }

    // ===== DRAWING =====
    function drawBgStars() {
        const now = Date.now();
        const nebulaOuter = ctx.createRadialGradient(canvasW/2,canvasH/2,0,canvasW/2,canvasH/2,canvasW/1.5);
        nebulaOuter.addColorStop(0,'rgba(20,20,22,0.4)');
        nebulaOuter.addColorStop(0.5,'rgba(12,12,14,0.2)');
        nebulaOuter.addColorStop(1,'transparent');
        ctx.fillStyle = nebulaOuter;
        ctx.fillRect(0,0,canvasW,canvasH);

        const pxOffset = player ? (player.x-canvasW/2)*0.05 : 0;
        const pyOffset = player ? (player.y-canvasH/2)*0.05 : 0;

        for(const star of bgStars) {
            star.y += star.speed;
            if(star.y > canvasH){ star.y=0; star.x=Math.random()*canvasW; }
            const flicker = 0.5 + Math.sin(now*0.002+star.brightness*10)*0.3;
            ctx.globalAlpha = flicker*(star.layer===3?0.8:0.6);
            ctx.fillStyle = star.color || '#ffffff';
            const lpX = pxOffset*star.layer, lpY = pyOffset*star.layer;
            let dx = star.x-lpX, dy = star.y-lpY;
            if(dx<-20) dx+=canvasW+40; if(dx>canvasW+20) dx-=canvasW+40;
            if(dy<-20) dy+=canvasH+40; if(dy>canvasH+20) dy-=canvasH+40;
            ctx.fillRect(dx,dy,star.size,star.size);
            if(star.layer===3){ ctx.globalAlpha=flicker*0.3; ctx.fillRect(dx-star.size/2,dy-star.size/2,star.size*2,star.size*2); }
        }
        ctx.globalAlpha = 1;
    }

    function drawGrid() {
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = '#00dbde';
        ctx.lineWidth = 1;
        const spacing = 60;
        for(let x=0;x<canvasW;x+=spacing){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvasH); ctx.stroke(); }
        for(let y=0;y<canvasH;y+=spacing){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvasW,y); ctx.stroke(); }
        ctx.globalAlpha = 1;
    }

    function drawPlayer(now, isInvul) {
        if(isInvul && Math.floor(now/80)%2===0) return;
        const px=player.x, py=player.y;
        player.trail.push({x:px,y:py});
        if(player.trail.length>15) player.trail.shift();
        if(player.trail.length>2) {
            ctx.strokeStyle = '#00dbde';
            ctx.shadowColor = '#00dbde';
            for(let i=1;i<player.trail.length;i++){
                ctx.beginPath();
                ctx.moveTo(player.trail[i-1].x,player.trail[i-1].y);
                ctx.lineTo(player.trail[i].x,player.trail[i].y);
                ctx.globalAlpha = i/player.trail.length;
                ctx.lineWidth = (i/player.trail.length)*5;
                ctx.shadowBlur = (i/player.trail.length)*10;
                ctx.stroke();
            }
            ctx.globalAlpha=1; ctx.shadowBlur=0;
        }
        const pulse = Math.abs(Math.sin(now*0.005))*10;
        const gradient = ctx.createRadialGradient(px,py,0,px,py,25+pulse);
        gradient.addColorStop(0,'rgba(0,219,222,0.4)');
        gradient.addColorStop(1,'rgba(0,219,222,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(px-(35+pulse),py-(35+pulse),70+pulse*2,70+pulse*2);

        ctx.save();
        ctx.translate(px,py);
        const tiltX = player.vx/player.speed, tiltY = player.vy/player.speed;
        ctx.transform(1,tiltX*0.2,tiltY*0.2,1,0,0);
        ctx.scale(1-Math.abs(tiltX)*0.15,1-Math.abs(tiltY)*0.15);
        ctx.rotate(now*0.001);
        ctx.fillStyle = isInvul?'#ffffff':'#00dbde';
        ctx.shadowColor = isInvul?'#ffffff':'#00dbde';
        ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(9,0); ctx.lineTo(0,9); ctx.lineTo(-9,0); ctx.closePath(); ctx.fill();
        const corePulse = Math.abs(Math.sin(now*0.015))*2;
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(0,-(4+corePulse)); ctx.lineTo(4+corePulse,0); ctx.lineTo(0,4+corePulse); ctx.lineTo(-(4+corePulse),0); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0; ctx.restore();
    }

    function drawLaser(now) {
        let da = Math.atan2(player.y-canvasH/2,player.x-canvasW/2)-laser.angle;
        while(da<-Math.PI) da+=Math.PI*2; while(da>Math.PI) da-=Math.PI*2;
        laser.angle += da*0.02;
        laser.targetWidth = 12+Math.sin(now*0.01)*4;
        laser.width += (laser.targetWidth-laser.width)*0.2;
        const lx=canvasW/2,ly=canvasH/2,tx=lx+Math.cos(laser.angle)*3000,ty=ly+Math.sin(laser.angle)*3000;
        ctx.strokeStyle='rgba(255,0,0,0.5)'; ctx.lineWidth=1; ctx.setLineDash([5,5]);
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(lx+Math.cos(laser.angle+da*5)*3000,ly+Math.sin(laser.angle+da*5)*3000); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle='rgba(252,0,255,0.12)'; ctx.lineWidth=laser.width+25+Math.sin(now*0.05)*5;
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(tx,ty); ctx.stroke();
        ctx.strokeStyle='rgba(252,0,255,0.25)'; ctx.lineWidth=laser.width+10;
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(tx,ty); ctx.stroke();
        ctx.strokeStyle='#fc00ff'; ctx.lineWidth=laser.width;
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(tx,ty); ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=laser.width/3;
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(tx,ty); ctx.stroke();
        const pulse=Math.abs(Math.sin(now*0.01))*5;
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(lx,ly,15+pulse,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#fc00ff'; ctx.lineWidth=3; ctx.shadowColor='#fc00ff'; ctx.shadowBlur=20; ctx.stroke(); ctx.shadowBlur=0;
        if(Math.random()>0.5){
            const ang=laser.angle+(Math.random()-0.5)*0.6;
            const startDist=15+Math.random()*10;
            particles.push({x:lx+Math.cos(ang)*startDist+(Math.random()-0.5)*40,y:ly+Math.sin(ang)*startDist+(Math.random()-0.5)*40,vx:Math.cos(ang)*15+(Math.random()-0.5)*5,vy:Math.sin(ang)*15+(Math.random()-0.5)*5,life:1.0,decay:0.05,size:Math.random()*3+1,color:'#fc00ff'});
        }
        const isInvul = Date.now()<player.invulUntil;
        const lDist = Math.abs(Math.sin(laser.angle)*(player.x-lx)-Math.cos(laser.angle)*(player.y-ly));
        if(!isInvul && lDist<(laser.width/2+4)) takeDamage();
    }

    function drawEnemies(now) {
        const isInvul = now < player.invulUntil;
        for(let i=enemies.length-1;i>=0;i--){
            const e = enemies[i];
            const age = now-(e.spawnTime||startTime);
            const lifespan = e.lifespan||6000;
            const remaining = lifespan-age;
            let scale = Math.min(1, age/300);
            if(remaining<500) scale *= Math.max(0,remaining/500);

            if(e.isHazard) {
                if(e.shape === 'gravity') {
                    e.size += (e.maxSize-e.size)*0.03;
                    ctx.globalAlpha = scale * (0.3+Math.sin(now*0.005)*0.1);
                    const g = ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size);
                    g.addColorStop(0,'rgba(80,0,255,0.5)'); g.addColorStop(1,'transparent');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(e.x,e.y,e.size,0,Math.PI*2); ctx.fill();
                    ctx.globalAlpha = 1;
                    if(Math.hypot(player.x-e.x,player.y-e.y)<e.size) player.hazardSlow = true;
                } else if(e.shape === 'wind') {
                    ctx.globalAlpha = scale * 0.4;
                    ctx.strokeStyle = '#aabbee'; ctx.lineWidth = 1;
                    for(let w=0;w<25;w++){
                        let wx=(now*e.vx+w*140)�nvasW, wy=(now*e.vy+w*90)�nvasH;
                        if(wx<0) wx+=canvasW; if(wy<0) wy+=canvasH;
                        ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(wx+e.vx*12,wy+e.vy*12); ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                    player.hazardWind = {x:e.vx,y:e.vy};
                } else if(e.shape === 'fog') {
                    ctx.globalAlpha = scale * 0.98;
                    ctx.fillStyle = e.color; ctx.fillRect(0,0,canvasW,canvasH);
                    ctx.globalCompositeOperation = 'destination-out';
                    const pulse = 100 + Math.sin(now*0.005)*15;
                    const g = ctx.createRadialGradient(player.x,player.y,pulse*0.2,player.x,player.y,pulse);
                    g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(player.x,player.y,pulse,0,Math.PI*2); ctx.fill();
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = 1;
                }
                if(remaining<=0) enemies.splice(i,1);
                continue;
            }

            // Movement
            if(e.wave){ e.x+=e.vx*scale+Math.sin(now*0.01+e.off)*2; e.y+=e.vy*scale; }
            else if(e.sine){ e.x+=e.vx*scale; e.y=e.baseY+Math.sin(now*0.005+e.off)*150; }
            else if(e.spinner){ e.rad+=3*scale; e.ang+=0.05; e.x=canvasW/2+Math.cos(e.ang)*e.rad; e.y=canvasH/2+Math.sin(e.ang)*e.rad; }
            else if(e.pulsar){ e.rad+=Math.sin(now*0.002)*5*scale; e.x=canvasW/2+Math.cos(e.ang)*e.rad; e.y=canvasH/2+Math.sin(e.ang)*e.rad; }
            else if(e.orbiter){ e.rad=Math.max(0,e.rad-1.2*scale); e.ang+=0.03*scale; e.x=e.centerX+Math.cos(e.ang)*e.rad; e.y=e.centerY+Math.sin(e.ang)*e.rad; }
            else{ e.x+=e.vx*scale; e.y+=e.vy*scale; }

            if(e.b&&(e.x<0||e.x>canvasW)){e.vx*=-1;e.b--;}
            if(e.b&&(e.y<0||e.y>canvasH)){e.vy*=-1;e.b--;}

            if(e.trail&&Math.random()>0.3) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.5,life:0.5,decay:0.025,size:e.size*0.5,color:e.color});

            if(e.glow){
                ctx.globalAlpha=scale;
                const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size*3*scale);
                g.addColorStop(0,e.glow); g.addColorStop(1,'transparent');
                ctx.fillStyle=g; ctx.fillRect(e.x-e.size*3*scale,e.y-e.size*3*scale,e.size*6*scale,e.size*6*scale);
                ctx.globalAlpha=1;
            }

            ctx.globalAlpha=scale;
            ctx.fillStyle=e.color; ctx.strokeStyle=e.color; ctx.shadowColor=e.color; ctx.shadowBlur=10*scale;
            ctx.save(); ctx.translate(e.x,e.y); ctx.scale(scale,scale);
            if(e.angle!==undefined) ctx.rotate(e.angle);
            else if(e.shape!=='circle') ctx.rotate(now*0.003+(e.off||0));
            ctx.beginPath();
            const s=e.size;
            switch(e.shape||'circle'){
                case 'triangle': ctx.moveTo(s,0);ctx.lineTo(-s,s);ctx.lineTo(-s,-s);ctx.closePath();ctx.fill(); break;
                case 'square': ctx.rect(-s,-s,s*2,s*2);ctx.fill(); break;
                case 'cross': ctx.rect(-s*1.2,-s*0.3,s*2.4,s*0.6);ctx.rect(-s*0.3,-s*1.2,s*0.6,s*2.4);ctx.fill(); break;
                case 'ring': ctx.lineWidth=2;ctx.arc(0,0,s,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,s/3,0,Math.PI*2);ctx.fill(); break;
                default: ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.shadowBlur=0;ctx.beginPath();ctx.arc(0,0,s/2.5,0,Math.PI*2);ctx.fill();
            }
            ctx.restore(); ctx.shadowBlur=0; ctx.globalAlpha=1;

            if(remaining>500&&!isInvul&&Math.hypot(player.x-e.x,player.y-e.y)<(e.size+6)) takeDamage();
            if(e.x<-200||e.x>canvasW+200||e.y<-200||e.y>canvasH+200||remaining<=0) enemies.splice(i,1);
        }
    }

    // ===== GAME LOOP =====
    function loop() {
        if(!gameRunning || isPaused) return;
        animationId = requestAnimationFrame(loop);
        ctx.fillStyle='rgba(5,5,15,0.35)';
        ctx.fillRect(0,0,canvasW,canvasH);
        const now=Date.now(), elapsed=now-startTime;
        const isInvul=now<player.invulUntil;

        drawBgStars();
        drawGrid();

        // Dash logic
        if(keys['Space']&&now>player.dashCooldown&&gameRunning){
            player.isDashing=true;
            player.dashTime=now+150;
            player.dashCooldown=now+4000;
            player.invulUntil=Math.max(player.invulUntil,player.dashTime);
            spawnParticles(player.x,player.y,10,'#ffffff');
            spawnShockwave(player.x,player.y,'#00dbde');
        }
        if(player.isDashing&&now>player.dashTime) player.isDashing=false;

        const baseSpd = player.isDashing ? player.speed*3.5 : player.speed;
        const currentSpeed = baseSpd * (player.hazardSlow && !player.isDashing ? 0.35 : 1);
        
        let dx=0, dy=0;
        if(keys['KeyW']||keys['ArrowUp']) dy-=currentSpeed;
        if(keys['KeyS']||keys['ArrowDown']) dy+=currentSpeed;
        if(keys['KeyA']||keys['ArrowLeft']) dx-=currentSpeed;
        if(keys['KeyD']||keys['ArrowRight']) dx+=currentSpeed;
        if(dx!==0&&dy!==0){const len=Math.sqrt(dx*dx+dy*dy);dx=(dx/len)*currentSpeed;dy=(dy/len)*currentSpeed;}

        if(player.hazardWind && !player.isDashing) {
            dx += player.hazardWind.x * 0.8;
            dy += player.hazardWind.y * 0.8;
        }

        // Reset hazards
        player.hazardSlow = false;
        player.hazardWind = null;

        if(player.isDashing&&Math.random()>0.2){
            particles.push({x:player.x,y:player.y,vx:0,vy:0,life:0.6,decay:0.05,size:player.size*1.5,color:'rgba(0,219,222,0.4)',isGeometric:true,shape:'triangle',angle:Math.atan2(dy,dx)+Math.PI/2});
        }

        player.vx=player.vx*0.8+dx*0.2;
        player.vy=player.vy*0.8+dy*0.2;
        player.x+=dx; player.y+=dy;
        player.x=Math.max(player.size,Math.min(canvasW-player.size,player.x));
        player.y=Math.max(player.size,Math.min(canvasH-player.size,player.y));

        const maxAllowed=Math.min(3,Math.floor(elapsed/5000)+1);
        if(elapsed>1500&&now-lastPatternTime>800){ for(let i=0;i<maxAllowed;i++) spawnPattern(); lastPatternTime=now; }

        drawLaser(now);
        drawEnemies(now);
        drawPlayer(now,isInvul);
        drawParticles();
        updateShockwaves();

        // Dash UI
        const dashRemaining=Math.max(0,player.dashCooldown-now);
        const dashProg=1-(dashRemaining/4000);
        if(dashFill){ dashFill.style.width=(dashProg*100)+'%'; if(dashProg>=1) dashFill.classList.add('ready'); else dashFill.classList.remove('ready'); }

        // Vignette
        const vignette=ctx.createRadialGradient(canvasW/2,canvasH/2,canvasH*0.3,canvasW/2,canvasH/2,canvasH*0.8);
        vignette.addColorStop(0,'transparent'); vignette.addColorStop(1,'rgba(0,0,0,0.4)');
        ctx.fillStyle=vignette; ctx.fillRect(0,0,canvasW,canvasH);

        score=Math.floor(elapsed/100);
        scoreEl.textContent=(score/10).toFixed(1);
        const diffPct=Math.min(100,(elapsed/60000)*100);
        diffFill.style.width=diffPct+'%';
        if(diffPct>75) diffFill.style.background='linear-gradient(90deg,#ff0000,#ff4444)';
        else if(diffPct>50) diffFill.style.background='linear-gradient(90deg,#ff5722,#fc00ff)';
    }

    // ===== GAME START / END =====
    function startGame(mode = 'normal') {
        isHardMode = (mode === 'hard');
        
        titleScreen.style.display='none';
        gameWrap.style.display='block';
        pauseOverlay.style.display='none';
        initCanvas();
        createBgStars();
        player={
            x:canvasW/2, y:canvasH/2, vx:0, vy:0,
            size:10, speed:8.5, color:'#00dbde',
            life:4, invulUntil:Date.now()+2000,
            trail:[], isDashing:false, dashTime:0, dashCooldown:0
        };
        enemies=[]; particles=[]; shockwaves=[];
        score=0; startTime=Date.now(); lastPatternTime=Date.now(); laser.angle=Math.PI;
        createHearts(); updateLifeUI(); updateBestDisplay();
        gameOverEl.style.display='none'; gameOverEl.classList.remove('visible');
        warningFlash.classList.remove('active');
        statusEl.textContent='LASER STABILIZED';
        diffFill.style.width='0%';
        diffFill.style.background='linear-gradient(90deg,#00dbde,#fc00ff)';
        gameRunning=true;
        isPaused=false;
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvasW,canvasH);
        canvas.classList.remove('glitch-effect');
        loop();
    }

    function endGame() {
        gameRunning=false;
        cancelAnimationFrame(animationId);
        warningFlash.classList.remove('active');
        
        let isNewRecord = false;
        if (isHardMode) {
            if (score > bestScoreHard) { bestScoreHard = score; localStorage.setItem('escapeObsession_best_hard', bestScoreHard.toString()); isNewRecord = true; }
        } else {
            if (score > bestScoreNormal) { bestScoreNormal = score; localStorage.setItem('escapeObsession_best_normal', bestScoreNormal.toString()); isNewRecord = true; }
        }

        document.getElementById('final-score').textContent=(score/10).toFixed(1)+'s';
        document.getElementById('final-best').textContent=(isHardMode ? bestScoreHard : bestScoreNormal/10).toFixed(1)+'s';
        const nrs=document.getElementById('new-record-stat');
        if(nrs) nrs.style.display=isNewRecord?'flex':'none';
        gameOverEl.style.display='flex';
        setTimeout(()=>gameOverEl.classList.add('visible'),50);
        spawnParticles(player.x,player.y,40,'#ffffff',true);
        spawnParticles(player.x,player.y,20,'#ff4757',true);
        spawnShockwave(player.x,player.y,'#ff0000');
        function deathRender(){
            if(gameRunning) return;
            ctx.fillStyle='rgba(5,5,15,0.1)'; ctx.fillRect(0,0,canvasW,canvasH);
            drawParticles(); updateShockwaves();
            if(particles.length>0||shockwaves.length>0) requestAnimationFrame(deathRender);
        }
        deathRender();
    }

    function goToMenu(){
        gameRunning=false;
        isPaused=false;
        cancelAnimationFrame(animationId);
        pauseOverlay.style.display='none';
        gameWrap.style.display='none';
        titleScreen.style.display='flex';
        updateBestDisplay();
    }

    function togglePause() {
        if (!gameRunning || gameOverEl.classList.contains('visible')) return;
        
        isPaused = !isPaused;
        
        if (isPaused) {
            pauseStartTime = Date.now();
            pauseOverlay.style.display = 'flex';
        } else {
            const pausedDuration = Date.now() - pauseStartTime;
            startTime += pausedDuration;
            lastPatternTime += pausedDuration;
            player.invulUntil += pausedDuration;
            player.dashCooldown += pausedDuration;
            if (player.isDashing) player.dashTime += pausedDuration;
            for (let e of enemies) e.spawnTime += pausedDuration;
            
            pauseOverlay.style.display = 'none';
            loop();
        }
    }

    // ===== EVENT LISTENERS =====
    window.addEventListener('keydown',(e)=>{
        keys[e.code]=true;
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup',(e)=>keys[e.code]=false);
    window.addEventListener('blur',()=>{ 
        keys={}; 
        if (gameRunning && !isPaused && !gameOverEl.classList.contains('visible')) {
            togglePause();
        }
    });
    window.addEventListener('resize',()=>{ initCanvas(); createBgStars(); });

    const startNormalBtnEl = document.getElementById('startNormalBtn');
    const startHardBtnEl = document.getElementById('startHardBtn');
    const retryNormalBtnEl = document.getElementById('retryNormalBtn');
    const retryHardBtnEl = document.getElementById('retryHardBtn');
    const menuBtnEl = document.getElementById('menuBtn');
    const resumeBtnEl = document.getElementById('resumeBtn');
    const pauseMenuBtnEl = document.getElementById('pauseMenuBtn');
    const tipsBtnEl = document.getElementById('tipsBtn');
    const closeTipsBtnEl = document.getElementById('closeTipsBtn');
    const tipsOverlay = document.getElementById('tips-overlay');
    
    if(startNormalBtnEl) startNormalBtnEl.addEventListener('click',()=>startGame('normal'));
    if(startHardBtnEl) startHardBtnEl.addEventListener('click',()=>startGame('hard'));
    if(retryNormalBtnEl) retryNormalBtnEl.addEventListener('click',()=>startGame('normal'));
    if(retryHardBtnEl) retryHardBtnEl.addEventListener('click',()=>startGame('hard'));
    if(resumeBtnEl) resumeBtnEl.addEventListener('click', togglePause);
    if(pauseMenuBtnEl) pauseMenuBtnEl.addEventListener('click', goToMenu);
    if(menuBtnEl) menuBtnEl.addEventListener('click',goToMenu);
    
    if(tipsBtnEl) tipsBtnEl.addEventListener('click', () => { tipsOverlay.style.display = 'flex'; });
    if(closeTipsBtnEl) closeTipsBtnEl.addEventListener('click', () => { tipsOverlay.style.display = 'none'; });

    window.addEventListener('keydown',(e)=>{
        if(e.code==='Space'||e.code==='Enter'){
            if(!gameRunning && tipsOverlay.style.display === 'none'){
                if(titleScreen.style.display!=='none'||gameOverEl.classList.contains('visible')){
                    e.preventDefault(); startGame(isHardMode ? 'hard' : 'normal');
                }
            }
        }
        if(e.code==='Escape' || e.code === 'KeyP'){
            if(tipsOverlay.style.display === 'flex') {
                tipsOverlay.style.display = 'none';
            } else if(gameOverEl.classList.contains('visible')) {
                goToMenu();
            } else {
                togglePause();
            }
        }
    });

    updateBestDisplay();
})();