// Игровой модуль, управляемый React-приложением
window.GameRunner = (function() {
    // Переменные, которые будут доступны во всем модуле
    let canvas, ctx, gameContainer, gameOverlay, overlayTitle, finalScoreDisplay, highScoresDisplay, friendRecordDisplay, globalRecordDisplay, restartButton;
    
    let score, lives, gameSpeed;
    let gameOver, gameStarted;
    let player, playerTrail;
    let obstacles, obstacleTimer, nextObstacleInterval;
    let stars;
    let animationFrameId; // ID для управления игровым циклом

    const API_URL = 'https://gametracker-backend-production.up.railway.app';
    const GAME_WIDTH = 900;
    const GAME_HEIGHT = 250;
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

    // --- ИМЕНОВАННЫЕ ОБРАБОТЧИКИ СОБЫТИЙ ---
    // Они должны быть именованными, чтобы их можно было удалить при очистке
    const handleKeyDown = (e) => {
        // 1. Игнорируем нажатия, если пользователь печатает в поле ввода
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            return;
        }

        // 2. Используем 'Enter' для старта/рестарта игры
        if (e.code === 'Enter' && (!gameStarted || gameOver)) {
            e.preventDefault(); // Предотвращаем стандартное действие Enter
            startGame();
        }

        // 3. Используем 'Пробел' ТОЛЬКО для прыжка во время активной игры
        if (e.code === 'Space' && gameStarted && !gameOver) {
            e.preventDefault(); // Предотвращаем прокрутку страницы
            jump();
        }
    };
    
    // --- ФУНКЦИИ ОТРИСОВКИ ---
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

    // --- ФУНКЦИИ ОБНОВЛЕНИЯ ИГРЫ ---
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

    // --- УПРАВЛЕНИЕ ИГРОВЫМ ПРОЦЕССОМ ---
    function jump() {
        if (!gameStarted || gameOver) return;
        if (player.jumpsLeft > 0) {
            player.velocityY = player.jumpStrength;
            player.jumpsLeft--;
            player.isJumping = true;
        }
    }
    
    function checkCollisions() {
        obstacles.forEach(obstacle => {
            if (player.x < obstacle.x + obstacle.width &&
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

    function resetGame() {
        score = 0; lives = 3; gameSpeed = 5;
        obstacles = []; obstacleTimer = 0; nextObstacleInterval = 120;
        player.y = GAME_HEIGHT - player.height - 20;
        player.velocityY = 0; player.jumpsLeft = 2; playerTrail = [];
        gameOver = false;
        gameOverlay.style.display = 'none';
        
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoop();
    }

    function startGame() {
        if (gameStarted && !gameOver) return;
        gameStarted = true;
        resetGame();
    }

    function endGame() {
        gameOver = true;
        gameStarted = false;
        submitScore(score);
        showGameOverScreen();
    }
    
    // --- ИНТЕГРАЦИЯ С СЕРВЕРОМ ---
    async function submitScore(finalScore) {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            await fetch(`${API_URL}/api/game/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ score: finalScore })
            });
        } catch (error) {
            console.error('Failed to submit score:', error);
        }
    }

    async function fetchHighScores() {
        const token = localStorage.getItem('token');
        if (!token) {
            friendRecordDisplay.innerHTML = 'Войдите, чтобы видеть рекорды';
            globalRecordDisplay.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/game/highscores`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                friendRecordDisplay.innerHTML = `<strong>Рекорд друзей:</strong> ${data.friend.username} (${data.friend.score} оч.)`;
                globalRecordDisplay.innerHTML = `<strong>Общий рекорд:</strong> ${data.global.username} (${data.global.score} оч.)`;
            } else {
                throw new Error('Failed to fetch scores');
            }
        } catch (error) {
            friendRecordDisplay.innerHTML = '<strong>Рекорд друзей:</strong> Ошибка';
            globalRecordDisplay.innerHTML = '<strong>Общий рекорд:</strong> Ошибка';
        }
    }

    // --- УПРАВЛЕНИЕ UI ---
    function showGameOverScreen() {
        overlayTitle.textContent = 'Игра окончена';
        finalScoreDisplay.textContent = `Ваши очки: ${score}`;
        restartButton.textContent = 'Играть снова';
        highScoresDisplay.style.display = 'block';
        gameOverlay.style.display = 'flex';
        fetchHighScores();
    }

    function showStartScreen() {
        overlayTitle.textContent = 'Начать игру';
        finalScoreDisplay.textContent = 'Нажмите Enter или Старт';
        restartButton.textContent = 'Старт';
        highScoresDisplay.style.display = 'none';
        gameOverlay.style.display = 'flex';
    }

    // --- ГЛАВНЫЙ ЦИКЛ И ФУНКЦИИ МОДУЛЯ ---
    function gameLoop() {
        if (gameOver) {
            animationFrameId = null;
            return;
        }
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        drawBackground();
        updatePlayer();
        drawPlayer();
        updateObstacles();
        drawObstacles();
        checkCollisions();
        drawUI();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    // Функция очистки
    function destroy() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        window.removeEventListener('keydown', handleKeyDown);
        restartButton.removeEventListener('click', startGame);
        console.log("Game instance destroyed.");
    }

    // Главная функция инициализации, вызываемая из React
    function init(canvasElement) {
        canvas = canvasElement;
        if (!canvas) {
            console.error("GameRunner init failed: canvas element not provided.");
            return;
        }

        ctx = canvas.getContext('2d');
        gameContainer = document.getElementById('game-container');
        gameOverlay = document.getElementById('game-overlay');
        overlayTitle = document.getElementById('overlay-title');
        finalScoreDisplay = document.getElementById('final-score');
        highScoresDisplay = document.getElementById('high-scores');
        friendRecordDisplay = document.getElementById('friend-record');
        globalRecordDisplay = document.getElementById('global-record');
        restartButton = document.getElementById('restart-button');
        
        // Сбрасываем состояние игры
        score = 0; lives = 3; gameSpeed = 5;
        gameOver = false; gameStarted = false;
        player = {
            x: 50, y: GAME_HEIGHT - 50, width: 30, height: 35,
            velocityY: 0, gravity: 0.6, jumpStrength: -12, jumpsLeft: 2, isJumping: false
        };
        playerTrail = [];
        obstacles = []; obstacleTimer = 0; nextObstacleInterval = 120;
        stars = [];
        for (let i = 0; i < 100; i++) {
            stars.push({
                x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT,
                radius: Math.random() * 1.5, alpha: Math.random()
            });
        }

        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;

        const reloadHint = document.getElementById('game-reload-hint');
        if(reloadHint) reloadHint.style.display = 'none';

        window.addEventListener('keydown', handleKeyDown);
        restartButton.addEventListener('click', startGame);

        showStartScreen();

        console.log("Game instance initialized.");
        
        // Возвращаем объект с функцией очистки
        return { destroy };
    }

    // Публичный API модуля
    return {
        init,
    };
})();
