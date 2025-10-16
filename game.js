<script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const gameContainer = document.getElementById('game-container');
    
    // UI Элементы
    const gameOverlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const finalScoreDisplay = document.getElementById('final-score');
    const highScoresDisplay = document.getElementById('high-scores');
    const restartButton = document.getElementById('restart-button');

    const GAME_WIDTH = 900;
    const GAME_HEIGHT = 250;
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    // Цветовая палитра
    const COLORS = {
        PLAYER: '#f472b6',
        PLAYER_GLOW: 'rgba(244, 114, 182, 0.5)',
        OBSTACLE_1: '#a78bfa',
        OBSTACLE_GLOW_1: 'rgba(167, 139, 250, 0.4)',
        OBSTACLE_2: '#c084fc',
        OBSTACLE_GLOW_2: 'rgba(192, 132, 252, 0.4)',
        GROUND: '#181825',
        GROUND_LINE: '#3c2c8b',
        SKY_TOP: '#11111b',
        SKY_BOTTOM: '#23233c',
        UI_ACCENT: '#a78bfa',
    };

    // Состояние игры
    let score = 0, lives = 3, gameSpeed = 5;
    let gameOver = false, gameStarted = false;
    
    // Игрок
    const player = {
        x: 50, y: GAME_HEIGHT - 50, width: 30, height: 35,
        velocityY: 0, gravity: 0.6, jumpStrength: -12, jumpsLeft: 2, isJumping: false
    };
    let playerTrail = [];

    // Препятствия
    let obstacles = [], obstacleTimer = 0, nextObstacleInterval = 120;

    // Фон
    let stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT,
            radius: Math.random() * 1.5, alpha: Math.random()
        });
    }
    
    function drawPlayer() {
        ctx.fillStyle = COLORS.PLAYER_GLOW;
        playerTrail.forEach((p, index) => {
            const size = (player.width / 2) * (index / playerTrail.length);
            ctx.globalAlpha = 0.1 * (index / playerTrail.length);
            ctx.beginPath();
            ctx.arc(p.x + player.width / 2, p.y + player.height / 2, size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.PLAYER_GLOW;

        ctx.fillStyle = COLORS.PLAYER;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y + player.height);
        ctx.quadraticCurveTo(player.x + player.width / 2, player.y - 10, player.x + player.width, player.y + player.height);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    function drawCrystalObstacle(obstacle) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.OBSTACLE_GLOW_1;
        ctx.fillStyle = obstacle.color;
        
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
        ctx.lineTo(obstacle.x + obstacle.width * 0.2, obstacle.y + obstacle.height * 0.5);
        ctx.lineTo(obstacle.x + obstacle.width * 0.5, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width * 0.8, obstacle.y + obstacle.height * 0.5);
        ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    function drawAnomalyObstacle(obstacle) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.OBSTACLE_GLOW_2;
        ctx.fillStyle = obstacle.color;

        const centerX = obstacle.x + obstacle.width / 2;
        const centerY = obstacle.y + obstacle.height / 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - obstacle.height / 2);
        ctx.lineTo(centerX + obstacle.width / 2, centerY);
        ctx.lineTo(centerX, centerY + obstacle.height / 2);
        ctx.lineTo(centerX - obstacle.width / 2, centerY);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    function drawObstacles() {
        obstacles.forEach(obstacle => obstacle.drawFunc(obstacle));
    }

    function drawBackground() {
        const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        sky.addColorStop(0, COLORS.SKY_TOP);
        sky.addColorStop(1, COLORS.SKY_BOTTOM);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        stars.forEach(star => {
            star.x -= gameSpeed * 0.1;
            if (star.x < 0) star.x = GAME_WIDTH;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
            ctx.fill();
        });

        ctx.fillStyle = COLORS.GROUND;
        ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);
        ctx.fillStyle = COLORS.GROUND_LINE;
        ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 3);
    }
    
    function drawUI() {
        ctx.font = "bold 24px Inter";
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.fillText(`Очки: ${score}`, 20, 35);
        for (let i = 0; i < lives; i++) drawHeart(GAME_WIDTH - 35 - (i * 30), 22, 12, 12);
    }
    
    function drawHeart(x, y, width, height) {
        ctx.fillStyle = COLORS.UI_ACCENT;
        ctx.beginPath();
        ctx.moveTo(x, y + height * 0.3);
        ctx.bezierCurveTo(x, y, x - width / 2, y, x - width / 2, y + height * 0.3);
        ctx.bezierCurveTo(x - width / 2, y + (height + height * 0.3) / 2, x, y + (height + height * 0.3) / 2, x, y + height);
        ctx.bezierCurveTo(x, y + (height + height * 0.3) / 2, x + width / 2, y + (height + height * 0.3) / 2, x + width / 2, y + height * 0.3);
        ctx.bezierCurveTo(x + width / 2, y, x, y, x, y + height * 0.3);
        ctx.closePath();
        ctx.fill();
    }
    
    function updatePlayer() {
        player.velocityY += player.gravity;
        player.y += player.velocityY;
        
        playerTrail.push({ x: player.x, y: player.y });
        if (playerTrail.length > 10) playerTrail.shift();
        
        const groundLevel = GAME_HEIGHT - player.height - 20;
        if (player.y > groundLevel) {
            player.y = groundLevel;
            player.velocityY = 0;
            if (player.isJumping) {
                player.jumpsLeft = 2;
                player.isJumping = false;
            }
        }
    }
    
    function updateObstacles() {
        obstacleTimer++;
        if (obstacleTimer > nextObstacleInterval) {
            spawnObstacle();
            obstacleTimer = 0;
            if (nextObstacleInterval > 60) nextObstacleInterval -= 1;
        }
        
        obstacles.forEach((obstacle, index) => {
            obstacle.x -= gameSpeed;
            if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
                score++;
                obstacle.passed = true;
                gameSpeed += 0.05;
            }
            if (obstacle.x + obstacle.width < 0) {
                setTimeout(() => obstacles.splice(index, 1), 0);
            }
        });
    }
    
    function spawnObstacle() {
        const obstacleTypes = [
            { width: 40, height: 50, color: COLORS.OBSTACLE_1, drawFunc: drawCrystalObstacle },
            { width: 45, height: 45, color: COLORS.OBSTACLE_2, drawFunc: drawAnomalyObstacle },
        ];
        
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        obstacles.push({
            x: GAME_WIDTH, y: GAME_HEIGHT - type.height - 20, ...type, passed: false
        });
    }
    
    function checkCollisions() {
        obstacles.forEach(obstacle => {
            if (
                player.x < obstacle.x + obstacle.width &&
                player.x + player.width > obstacle.x &&
                player.y < obstacle.y + obstacle.height &&
                player.y + player.height > obstacle.y
            ) { handleCollision(); }
        });
    }

    function handleCollision() {
        lives--;
        obstacles = [];
        obstacleTimer = -60;
        if (lives <= 0) {
            endGame();
        } else {
            gameContainer.style.borderColor = 'red';
            setTimeout(() => gameContainer.style.borderColor = '#8b5cf6', 200);
        }
    }
    
    function jump() {
        if (!gameStarted || gameOver) return;
        if (player.jumpsLeft > 0) {
            player.velocityY = player.jumpStrength;
            player.jumpsLeft--;
            player.isJumping = true;
        }
    }

    function showGameOverScreen() {
        overlayTitle.textContent = 'Игра окончена';
        finalScoreDisplay.textContent = `Ваши очки: ${score}`;
        restartButton.textContent = 'Играть снова';
        highScoresDisplay.style.display = 'block';
        gameOverlay.style.display = 'flex';
    }

    function showStartScreen() {
        /* --- ИЗМЕНЕНО: Обновлен стартовый экран --- */
        overlayTitle.textContent = 'Начать игру';
        finalScoreDisplay.textContent = 'Нажмите Пробел';
        restartButton.textContent = 'Старт';
        highScoresDisplay.style.display = 'none';
        gameOverlay.style.display = 'flex';
    }
    
    function resetGame() {
        score = 0; lives = 3; gameSpeed = 5;
        obstacles = []; obstacleTimer = 0; nextObstacleInterval = 120;
        player.y = GAME_HEIGHT - player.height - 20;
        player.velocityY = 0; player.jumpsLeft = 2; playerTrail = [];
        gameOver = false;
        gameOverlay.style.display = 'none';
        requestAnimationFrame(gameLoop);
    }

    function startGame() {
        gameStarted = true;
        resetGame();
    }

    function endGame() {
        gameOver = true;
        showGameOverScreen();
    }

    function gameLoop() {
        if (gameOver) return;
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        drawBackground();
        updatePlayer();
        drawPlayer();
        updateObstacles();
        drawObstacles();
        checkCollisions();
        drawUI();
        
        requestAnimationFrame(gameLoop);
    }
    
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!gameStarted || gameOver) startGame();
            else jump();
        }
    });

    restartButton.addEventListener('click', () => {
        if (gameOver || !gameStarted) startGame();
    });
    
    showStartScreen();
</script>