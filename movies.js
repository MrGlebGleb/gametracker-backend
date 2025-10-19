const { useState, useEffect, useRef, Fragment, useCallback } = React;

// --- Глобальные константы и хелперы ---
// Обфусцированный API URL для базовой защиты
const getApiUrl = () => {
  const encoded = 'aHR0cHM6Ly9nYW1ldHJhY2tlci1iYWNrZW5kLXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHA=';
  return atob(encoded);
};
const API_URL = getApiUrl();
const REACTION_EMOJIS = ['😍', '🔥', '👍', '😮', '😂', '👎', '❤️', '🤔', '😢', '🤯'];
const MEDIA_PER_COLUMN = 5;

// --- Переиспользуемые UI-компоненты (идентичны странице игр) ---

// === ЭПИЧЕСКАЯ АНИМАЦИЯ 5 ЗВЕЗД ===

// Система частиц
const ParticleSystem = ({ particles, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete && onComplete();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      {particles.map((particle, index) => (
        <div
          key={index}
          className="epic-particle"
          style={{
            left: particle.x,
            top: particle.y,
            backgroundColor: particle.color,
            transform: `translate(${particle.dx}px, ${particle.dy}px)`,
            opacity: particle.opacity,
            width: particle.size,
            height: particle.size,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            transition: `all ${particle.duration}ms ease-out`,
          }}
        />
      ))}
    </>
  );
};

// Компонент звезды
const AnimatedStar = ({ index, isActive, position, size = 80 }) => {
  if (!isActive) return null;
  
  return (
    <div 
      className="epic-star"
      style={{
        left: position.x,
        bottom: position.y,
        fontSize: size,
        animationDelay: `${index * 0.1}s`
      }}
    >
      ★
    </div>
  );
};

// Энергетические кольца
const EnergyRings = ({ isActive, centerX, centerY }) => {
  if (!isActive) return null;
  
  return (
    <>
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          className="energy-ring"
          style={{
            left: centerX - 50,
            top: centerY - 50,
            width: 100,
            height: 100,
            animationDelay: `${ring * 0.3}s`,
            borderColor: ring === 0 ? 'rgba(160, 210, 235, 0.6)' : 
                        ring === 1 ? 'rgba(255, 215, 0, 0.4)' : 
                        'rgba(255, 20, 147, 0.5)'
          }}
        />
      ))}
    </>
  );
};

// Вспышка света
const FlashEffect = ({ isActive }) => {
  if (!isActive) return null;
  
  return <div className="flash-overlay" />;
};

// Главный компонент эпической анимации
const EpicFiveStarAnimation = ({ posterUrl, cardId, onComplete }) => {
  const [stage, setStage] = useState(0);
  const [particles, setParticles] = useState([]);
  const [showGlow, setShowGlow] = useState(false);
  const [showRings, setShowRings] = useState(false);
  const [stars, setStars] = useState([]);
  const [isReturning, setIsReturning] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0, width: 64, height: 96 });
  
  // Генерация частиц - вылетают из-за постера радиально
  const generateParticles = (centerX, centerY, count, colors, intensity = 1) => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      // Угол от 0 до 360 градусов для равномерного распределения
      const angle = (Math.PI * 2 * i) / count;
      const speed = 80 + Math.random() * 120; // Скорость разлета
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      newParticles.push({
        x: centerX, // Центр постера
        y: centerY, // Центр постера
        // Вылетают ИЗ-ЗА постера во все стороны радиально
        dx: Math.cos(angle) * speed * intensity,
        dy: Math.sin(angle) * speed * intensity,
        color: color,
        size: 6 + Math.random() * 8,
        opacity: 0.9,
        duration: 1500 + Math.random() * 1000,
      });
    }
    return newParticles;
  };

  // Получение позиций звезд - выровнены в ряд под постером
  const getStarPositions = (posterX, posterY, posterWidth, posterHeight) => {
    const starSize = 60; // Размер одной звезды
    const totalWidth = starSize * 5; // 5 звезд
    const startX = posterX + (posterWidth / 2) - (totalWidth / 2); // Центрируем под постером
    const starY = posterY + posterHeight + 20; // 20px под постером
    
    return [
      { x: startX, y: starY },
      { x: startX + starSize, y: starY },
      { x: startX + starSize * 2, y: starY },
      { x: startX + starSize * 3, y: starY },
      { x: startX + starSize * 4, y: starY }
    ];
  };

  useEffect(() => {
    // Находим карточку в DOM
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      const posterImg = cardElement.querySelector('img');
      const posterRect = posterImg ? posterImg.getBoundingClientRect() : rect;
      
      setCardPosition({
        x: posterRect.left,
        y: posterRect.top,
        width: posterRect.width,
        height: posterRect.height
      });
    }
    
    const centerX = cardPosition.x + cardPosition.width / 2;
    const centerY = cardPosition.y + cardPosition.height / 2;
    
    const timeline = [
      { 
        time: 0, 
        action: () => {
          setStage(1);
          const positions = getStarPositions(cardPosition.x, cardPosition.y, cardPosition.width, cardPosition.height);
          setStars([{ index: 0, position: positions[0] }]);
          setParticles(generateParticles(centerX, centerY, 7, ['#FFD700', '#FFA500'], 0.5));
        }
      },
      { 
        time: 800, 
        action: () => {
          setStage(2);
          const positions = getStarPositions(cardPosition.x, cardPosition.y, cardPosition.width, cardPosition.height);
          setStars(prev => [...prev, { index: 1, position: positions[1] }]);
          setParticles(generateParticles(centerX, centerY, 10, ['#a0d2eb', '#FFD700'], 0.7));
        }
      },
      { 
        time: 1600, 
        action: () => {
          setStage(3);
          setShowRings(true);
          const positions = getStarPositions(cardPosition.x, cardPosition.y, cardPosition.width, cardPosition.height);
          setStars(prev => [...prev, { index: 2, position: positions[2] }]);
          setParticles(generateParticles(centerX, centerY, 15, ['#8458B3', '#d0bdf4', '#FFD700'], 1));
        }
      },
      { 
        time: 2400, 
        action: () => {
          setStage(4);
          const positions = getStarPositions(cardPosition.x, cardPosition.y, cardPosition.width, cardPosition.height);
          setStars(prev => [...prev, { index: 3, position: positions[3] }]);
          setParticles(generateParticles(centerX, centerY, 20, ['#FF00FF', '#00FFFF', '#FFD700', '#FF1493'], 1.2));
        }
      },
      { 
        time: 3200, 
        action: () => {
          setStage(5);
          setShowGlow(true);
          const positions = getStarPositions(cardPosition.x, cardPosition.y, cardPosition.width, cardPosition.height);
          setStars(prev => [...prev, { index: 4, position: positions[4] }]);
          setParticles(generateParticles(centerX, centerY, 30, ['#FFD700', '#FF1493', '#00FFFF', '#00FF00'], 1.5));
        }
      },
      { 
        time: 3500, 
        action: () => {
          setIsReturning(true);
          setStage(6);
        }
      },
      { 
        time: 4000, 
        action: () => {
          onComplete && onComplete();
        }
      }
    ];
    
    timeline.forEach(({ time, action }) => {
      setTimeout(action, time);
    });
    
    // Очистка glow эффекта
    setTimeout(() => setShowGlow(false), 800);
    
  }, [onComplete]);

  return (
    <div className={`epic-animation-overlay epic-stage-${stage}`}>
      {/* Мягкое золотое свечение вместо белой вспышки */}
      {showGlow && (
        <div 
          className="soft-glow-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.25) 0%, rgba(255, 215, 0, 0.1) 40%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'softGlow 0.8s ease-out',
            zIndex: 9995
          }}
        />
      )}
      
      {/* Постер остается на месте, только увеличивается */}
      <img 
        src={posterUrl || 'https://placehold.co/96x128/1f2937/ffffff?text=?'} 
        alt="Epic Poster"
        className={`epic-poster ${isReturning ? 'returning' : ''}`}
        style={{
          position: 'fixed',
          left: cardPosition.x,
          top: cardPosition.y,
          width: cardPosition.width,
          height: cardPosition.height,
          transform: 'scale(1)', // Начальное состояние
          zIndex: 9999,
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        }}
      />
      
      {/* Звезды выровнены в ряд под постером */}
      {stars.map((star, index) => (
        <AnimatedStar
          key={index}
          index={index}
          isActive={stage >= index + 1}
          position={{ x: star.position.x, y: star.position.y }}
          size={60}
        />
      ))}
      
      {/* Энергетические кольца */}
      <EnergyRings 
        isActive={showRings} 
        centerX={cardPosition.x + cardPosition.width / 2} 
        centerY={cardPosition.y + cardPosition.height / 2} 
      />
      
      {/* Система частиц */}
      <ParticleSystem 
        particles={particles} 
        onComplete={() => setParticles([])}
      />
    </div>
  );
};

// Компонент уведомлений
const NotificationsPanel = ({ token, onNavigateToUser, onNavigateToGame }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);

  // Загрузка уведомлений
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Загрузка счетчика непрочитанных
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Ошибка загрузки счетчика:', error);
    }
  }, [token]);

  // Отметить уведомление как прочитанное
  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Ошибка отметки уведомления:', error);
    }
  };

  // Отметить все как прочитанные
  const markAllAsRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Ошибка отметки всех уведомлений:', error);
    }
  };

  // Обработка клика по уведомлению
  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    if (notification.type === 'friend_request' && notification.from_user_id) {
      onNavigateToUser && onNavigateToUser(notification.from_user_id);
    } else if (notification.type === 'game_reaction' && notification.game_id) {
      onNavigateToGame && onNavigateToGame(notification.game_id);
    }
    
    setShowPanel(false);
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return `${Math.floor(diff / 86400000)} дн назад`;
  };

  // Загрузка данных при монтировании
  useEffect(() => {
    if (token) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [token, fetchNotifications, fetchUnreadCount]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="p-2 hover:bg-gray-800 rounded-lg border border-purple-500/30 relative"
        title="Уведомления"
      >
        <Icon name="bell" className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
        )}
      </button>

      {/* Выпадающее меню */}
      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 rounded-lg border border-gray-700 z-50 elevation-4">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Уведомления</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">
                <Icon name="loader" className="w-6 h-6 animate-spin mx-auto mb-2" />
                Загрузка...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <Icon name="bell" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-red-500/10 border-l-4 border-l-red-500' : 'bg-gray-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={notification.from_user_avatar || '/default-avatar.png'}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {notification.message}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">{formatTime(notification.created_at)}</p>
                      {!notification.is_read && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          <span className="text-red-400 text-xs font-medium">Новое</span>
                        </div>
                      )}
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Футер с кнопкой "Отметить все как прочитанные" */}
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <button
                onClick={markAllAsRead}
                className="w-full py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Icon name="check" className="w-4 h-4" />
                Отметить все как прочитанные
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Компонент страницы статистики
const StatisticsPage = ({ isOpen, onClose, token, boards, showMediaTab = true }) => {
  const [activeTab, setActiveTab] = useState('media');
  const [gamesStats, setGamesStats] = useState(null);
  const [mediaStats, setMediaStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  // Загрузка статистики медиа
  const loadMediaStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      console.log('Loading media stats, token exists:', !!token);
      console.log('Current boards state:', boards);
      
      const response = await fetch(`${API_URL}/api/user/statistics/media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Media statistics received from API:', data);
        setMediaStats(data);
      } else {
        console.log('API response not ok:', response.status, response.statusText);
        // Используем fallback статистику
        console.log('Using fallback stats...');
        const fallbackStats = createFallbackStats();
        console.log('Fallback stats created:', fallbackStats);
        setMediaStats(fallbackStats);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики медиа:', error);
      // Используем fallback статистику
      console.log('Using fallback stats due to error...');
      const fallbackStats = createFallbackStats();
      console.log('Fallback stats created:', fallbackStats);
      setMediaStats(fallbackStats);
    } finally {
      setLoading(false);
    }
  }, [token, boards, createFallbackStats]);

  // Функция создания fallback статистики из локальных данных
  const createFallbackStats = useCallback(() => {
    console.log('Full boards data:', boards);
    
    // Проверяем, что boards существует и имеет нужную структуру
    if (!boards || typeof boards !== 'object') {
      console.log('Boards is null or not an object, using empty stats');
      return {
        summary: { totalMovies: 0, totalTvShows: 0, watchedMedia: 0, averageRating: 0 },
        topMovies: [],
        monthlyStats: []
      };
    }
    
    const movies = boards.movies || { wishlist: [], watched: [] };
    const tv = boards.tv || { wishlist: [], watched: [] };
    
    console.log('Creating fallback stats from local data:', {
      movies: { wishlist: movies.wishlist.length, watched: movies.watched.length },
      tv: { wishlist: tv.wishlist.length, watched: tv.watched.length },
      fullBoards: boards
    });
    
    const watchedMovies = movies.watched.length;
    const watchedTvShows = tv.watched.length;
    const wishlistMovies = movies.wishlist.length;
    const wishlistTvShows = tv.wishlist.length;
    
    // Создаем топ фильмов из просмотренных
    const topMovies = movies.watched.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      poster: movie.poster,
      rating: movie.rating || 0
    })).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    
    // Создаем топ сериалов из просмотренных
    const topTv = tv.watched.map(series => ({
      id: series.id,
      title: series.title,
      year: series.year,
      poster: series.poster,
      rating: series.rating || 0
    })).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);

    // Создаем месячную статистику (последние 6 месяцев)
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
      
      // Подсчитываем фильмы, добавленные в этот месяц (если есть дата добавления)
      let mediaAdded = 0;
      let mediaWatched = 0;
      
      // Простая логика: распределяем фильмы по месяцам
      const allMedia = [...movies.wishlist, ...movies.watched, ...tv.wishlist, ...tv.watched];
      const watchedMedia = [...movies.watched, ...tv.watched];
      
      // Распределяем добавленные фильмы по месяцам
      mediaAdded = Math.floor((allMedia.length / 6) + Math.random() * 2);
      // Распределяем просмотренные фильмы по месяцам
      mediaWatched = Math.floor((watchedMedia.length / 6) + Math.random() * 3);
      
      monthlyStats.push({
        month: month,
        mediaAdded: Math.max(0, mediaAdded),
        mediaWatched: Math.max(0, mediaWatched)
      });
    }

    // Вычисляем средний рейтинг
    const allWatchedMedia = [...movies.watched, ...tv.watched];
    const ratedMedia = allWatchedMedia.filter(media => media.rating && media.rating > 0);
    const averageRating = ratedMedia.length > 0 
      ? parseFloat((ratedMedia.reduce((sum, media) => sum + (media.rating || 0), 0) / ratedMedia.length).toFixed(1))
      : 0;

    return {
      summary: {
        watchedMovies: watchedMovies,
        watchedTvShows: watchedTvShows,
        wishlistMovies: wishlistMovies,
        wishlistTvShows: wishlistTvShows,
        averageRating: averageRating
      },
      topMovies: topMovies,
      topTv: topTv,
      monthlyStats: monthlyStats
    };
  }, [boards]);

  // Загрузка данных при открытии
  useEffect(() => {
    if (isOpen) {
      console.log('Statistics opened, loading media stats...');
      console.log('Boards available:', !!boards);
      console.log('Boards structure:', boards);
      
      // Если boards еще не загружены, ждем немного
      if (!boards || (!boards.movies && !boards.tv)) {
        console.log('Boards not loaded yet, waiting...');
        const timer = setTimeout(() => {
          loadMediaStats();
        }, 1000);
        return () => clearTimeout(timer);
      }
      
      loadMediaStats();
    }
  }, [isOpen, loadMediaStats, boards]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a0f2e]/95 backdrop-blur-xl border border-[#8458B3]/50 modal-bg rounded-xl w-full max-w-4xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 pt-8">
          <div>
            <h2 className="text-2xl font-bold text-white">📊 Статистика фильмов</h2>
            {exportMessage && (
              <p className="text-sm text-green-400 mt-1">{exportMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ExportDropdown 
              onExport={() => {}} 
              loading={exportLoading} 
            />
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Icon name="x" className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Icon name="loader" className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : (
            <MediaStatsContent stats={mediaStats} />
          )}
        </div>
      </div>
    </div>
  );
};

// Компонент статистики медиа
const MediaStatsContent = ({ stats }) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  console.log('MediaStatsContent received stats:', stats);

  if (!stats) return <div className="text-gray-400">Загрузка...</div>;

  // Подготовка данных для графика
  const chartData = stats.monthlyStats?.map(month => ({
    month: month.month,
    added: month.mediaAdded || 0,
    completed: month.mediaWatched || 0
  })) || [];

  const handleChartHover = (data, index) => {
    if (data) {
      setTooltipData(data);
      setTooltipVisible(true);
    } else {
      setTooltipVisible(false);
    }
  };

  const handleMouseMove = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="space-y-6">
      {/* Карточки с числами */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#a0d2eb]/20 to-[#8458B3]/30 backdrop-blur-xl rounded-xl p-6 border border-[#a0d2eb]/40">
          <div className="text-3xl mb-2">🎬</div>
          <h3 className="text-sm font-semibold mb-1" style={{color: 'rgba(208, 189, 244, 0.9)'}}>Фильмов просмотрено</h3>
          <p className="text-3xl font-bold text-white" style={{textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'}}>{stats.summary?.watchedMovies || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-[#8458B3]/30 to-[#a28089]/25 backdrop-blur-xl rounded-xl p-6 border border-[#8458B3]/50">
          <div className="text-3xl mb-2">📺</div>
          <h3 className="text-sm font-semibold mb-1" style={{color: 'rgba(208, 189, 244, 0.9)'}}>Сериалов просмотрено</h3>
          <p className="text-3xl font-bold text-white" style={{textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'}}>{stats.summary?.watchedTvShows || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-[#d0bdf4]/20 to-[#a28089]/25 backdrop-blur-xl rounded-xl p-6 border border-[#d0bdf4]/40">
          <div className="text-3xl mb-2">📋</div>
          <h3 className="text-sm font-semibold mb-1" style={{color: 'rgba(208, 189, 244, 0.9)'}}>Фильмов отложено</h3>
          <p className="text-3xl font-bold text-white" style={{textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'}}>{stats.summary?.wishlistMovies || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-[#8458B3]/30 to-[#d0bdf4]/20 backdrop-blur-xl rounded-xl p-6 border border-[#8458B3]/50">
          <div className="text-3xl mb-2">⏳</div>
          <h3 className="text-sm font-semibold mb-1" style={{color: 'rgba(208, 189, 244, 0.9)'}}>Сериалов отложено</h3>
          <p className="text-3xl font-bold text-white" style={{textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'}}>{stats.summary?.wishlistTvShows || 0}</p>
        </div>
      </div>

      {/* График по месяцам */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">📈 Активность по месяцам</h3>
        <div className="relative" onMouseMove={handleMouseMove}>
          {chartData.length > 0 ? (
            <>
              <BarChart 
                data={chartData} 
                height={300} 
                onHover={handleChartHover}
              />
              <ChartLegend />
              <ChartTooltip 
                data={tooltipData} 
                visible={tooltipVisible} 
                x={tooltipPosition.x} 
                y={tooltipPosition.y} 
              />
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p>Нет данных для отображения</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Топ фильмов и сериалов */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Топ фильмов */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="film" className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Топ-10 фильмов</h3>
          </div>
          <div className="space-y-3">
            {stats.topMovies && stats.topMovies.length > 0 ? (
              stats.topMovies.slice(0, 10).map((movie, index) => (
                <div key={movie.id} className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-bold text-blue-400">
                    {index + 1}
                  </div>
                  <img src={movie.poster || 'https://placehold.co/40x56/1f2937/ffffff?text=?'} alt={movie.title} className="w-12 h-16 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{movie.title}</h4>
                    <p className="text-gray-400 text-sm">{movie.year}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Icon key={i} name="star" className={`w-4 h-4 ${i < (movie.rating || 0) ? 'text-[#a0d2eb]' : 'text-[#8458B3]/30'}`} style={i < (movie.rating || 0) ? {filter: 'drop-shadow(0 0 4px rgba(160, 210, 235, 0.5))'} : {}} />
                    ))}
                    <span className="ml-2 text-white font-medium">{movie.rating || 0}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-center py-8">Нет рейтинговых фильмов</div>
            )}
          </div>
        </div>

        {/* Топ сериалов */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="tv" className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Топ-10 сериалов</h3>
          </div>
          <div className="space-y-3">
            {stats.topTv && stats.topTv.length > 0 ? (
              stats.topTv.slice(0, 10).map((series, index) => (
                <div key={series.id} className="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-sm font-bold text-purple-400">
                    {index + 1}
                  </div>
                  <img src={series.poster || 'https://placehold.co/40x56/1f2937/ffffff?text=?'} alt={series.title} className="w-12 h-16 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{series.title}</h4>
                    <p className="text-gray-400 text-sm">{series.year}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Icon key={i} name="star" className={`w-4 h-4 ${i < (series.rating || 0) ? 'text-[#a0d2eb]' : 'text-[#8458B3]/30'}`} style={i < (series.rating || 0) ? {filter: 'drop-shadow(0 0 4px rgba(160, 210, 235, 0.5))'} : {}} />
                    ))}
                    <span className="ml-2 text-white font-medium">{series.rating || 0}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-center py-8">Нет рейтинговых сериалов</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Компонент графика
const BarChart = ({ data, width = 800, height = 300, onHover }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [chartDimensions, setChartDimensions] = useState({ width, height });

  // Адаптивный размер графика
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newWidth = Math.min(containerWidth - 32, 800);
        setChartDimensions({ width: newWidth, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    const { width: chartWidth, height: chartHeight } = chartDimensions;
    
    canvas.width = chartWidth;
    canvas.height = chartHeight;

    // Очистка canvas
    ctx.clearRect(0, 0, chartWidth, chartHeight);

    const padding = 60;
    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;
    const barWidth = innerWidth / data.length * 0.8;
    const barSpacing = innerWidth / data.length * 0.2;

    // Максимальное значение для масштабирования
    const maxValue = Math.max(...data.map(d => Math.max(d.added || 0, d.completed || 0)));

    // Рисование осей
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    // Вертикальная ось
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, chartHeight - padding);
    ctx.stroke();

    // Горизонтальная ось
    ctx.beginPath();
    ctx.moveTo(padding, chartHeight - padding);
    ctx.lineTo(chartWidth - padding, chartHeight - padding);
    ctx.stroke();

    // Рисование столбцов
    data.forEach((item, index) => {
      const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
      const addedHeight = ((item.added || 0) / maxValue) * innerHeight;
      const completedHeight = ((item.completed || 0) / maxValue) * innerHeight;

      // Столбец "Добавлено"
      const addedGradient = ctx.createLinearGradient(0, chartHeight - padding - addedHeight, 0, chartHeight - padding);
      addedGradient.addColorStop(0, '#d0bdf4');
      addedGradient.addColorStop(1, '#8458B3');
      ctx.fillStyle = addedGradient;
      ctx.fillRect(x, chartHeight - padding - addedHeight, barWidth / 2, addedHeight);

      // Столбец "Просмотрено"
      const completedGradient = ctx.createLinearGradient(0, chartHeight - padding - completedHeight, 0, chartHeight - padding);
      completedGradient.addColorStop(0, '#a0d2eb');
      completedGradient.addColorStop(1, '#e5eaf5');
      ctx.fillStyle = completedGradient;
      ctx.fillRect(x + barWidth / 2, chartHeight - padding - completedHeight, barWidth / 2, completedHeight);

      // Подписи месяцев
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(item.month, x + barWidth / 2, chartHeight - padding + 20);
    });

    // Подписи значений на оси Y
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = chartHeight - padding - (innerHeight / 5) * i;
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(value.toString(), padding - 10, y + 4);
    }
  }, [data, chartDimensions]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 60;
    const { width: chartWidth } = chartDimensions;
    const innerWidth = chartWidth - padding * 2;
    const barWidth = innerWidth / data.length * 0.8;
    const barSpacing = innerWidth / data.length * 0.2;

    const index = Math.floor((x - padding) / (barWidth + barSpacing));
    
    if (index >= 0 && index < data.length && x >= padding && x <= chartWidth - padding) {
      setHoveredIndex(index);
      if (onHover) {
        onHover(data[index], index);
      }
    } else {
      setHoveredIndex(null);
      if (onHover) {
        onHover(null, null);
      }
    }
  }, [data, chartDimensions, onHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    if (onHover) {
      onHover(null, null);
    }
  }, [onHover]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-pointer"
      />
    </div>
  );
};

// Компонент легенды графика
const ChartLegend = () => (
  <div className="flex items-center justify-center gap-6 mt-4">
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 bg-gradient-to-r from-d0bdf4 to-8458B3 rounded"></div>
      <span className="text-sm text-gray-300">Добавлено</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 bg-gradient-to-r from-a0d2eb to-e5eaf5 rounded"></div>
      <span className="text-sm text-gray-300">Просмотрено</span>
    </div>
  </div>
);

// Компонент tooltip
const ChartTooltip = ({ data, visible, x, y }) => {
  if (!visible || !data) return null;

  return (
    <div
      className="absolute bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl z-10 pointer-events-none"
      style={{
        left: x + 10,
        top: y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="text-white text-sm font-medium">{data.month}</div>
      <div className="text-purple-400 text-xs">Добавлено: {data.added || 0}</div>
      <div className="text-blue-400 text-xs">Просмотрено: {data.completed || 0}</div>
    </div>
  );
};

// Компонент dropdown для экспорта
const ExportDropdown = ({ onExport, loading }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors disabled:opacity-50"
      >
        <Icon name="download" className="w-4 h-4" />
        <span className="text-sm">{loading ? 'Экспорт...' : 'Экспорт'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-10">
          <div className="py-1">
            <button
              onClick={() => {
                onExport('csv');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              📊 Экспорт в CSV
            </button>
            <button
              onClick={() => {
                onExport('json');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              📄 Экспорт в JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Icon = ({ name, className = "w-5 h-5" }) => {
  const icons = {
    plus: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
    search: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    user: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    users: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    settings: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>,
    bell: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    check: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>,
    barChart: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>,
    upload: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    download: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,14 12,19 17,14"/><line x1="12" y1="19" x2="12" y2="5"/></svg>,
    logout: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
    star: <svg className={className} fill="currentColor" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    trash: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    x: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    loader: <svg className={className + " animate-spin"} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
    upload: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
    check: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
    userPlus: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
    userCheck: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
    userClock: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><circle cx="18" cy="18" r="3" /><path d="M20.5 16.5 18 18l.5 2.5"/></svg>,
    chevronUp: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>,
    chevronDown: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>,
    youtube: <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  };
  return icons[name] || null;
};

const Avatar = ({ src, size = 'md', className = '' }) => {
  const sizes = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-20 h-20', xl: 'w-32 h-32' };
  return src ? (
    <img src={src} className={`${sizes[size]} avatar-circle ${className}`} alt="avatar" />
  ) : (
    <div className={`${sizes[size]} avatar-circle bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold ${className}`}>
      <Icon name="user" className={size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} />
    </div>
  );
};

// --- Основные компоненты приложения ---

function StarRating({ value = 0, onChange }) {
  return (
    <div className="flex items-center gap-1 star-rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} onClick={() => onChange(star)} className="transition-transform hover:scale-110">
          <Icon name="star" className={`w-8 h-8 ${star <= value ? 'text-[#a0d2eb]' : 'text-[#8458B3]/30'}`} style={star <= value ? {filter: 'drop-shadow(0 0 4px rgba(160, 210, 235, 0.5))'} : {}} />
        </button>
      ))}
    </div>
  );
}

function MediaCard({ item, onSelect, onRemove, onDragStart, onDragEnd, isViewingFriend, boardId }) {
  const type = item.media_type || 'movie'; // Определяем тип медиа
  
  return (
    <div
      draggable={!isViewingFriend}
      onDragStart={(e) => !isViewingFriend && onDragStart(e, item)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(item)}
      data-card-id={item.id}
          className="bg-[#1a0f2e]/70 rounded-xl border border-[#8458B3]/30 hover:border-[#a0d2eb] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(160,210,235,0.4)] transition-all duration-200 cursor-pointer flex gap-3 p-2 group relative elevation-1 hover:elevation-2 shadow-transition media-card backdrop-blur-xl"
    >
      {/* Цветная полоска слева */}
      <div 
        className="w-1 rounded-l-xl flex-shrink-0" 
        style={{ backgroundColor: boardId === 'wishlist' ? '#a0d2eb' : '#8458B3', opacity: 0.8, boxShadow: '0 0 10px currentColor' }}
      ></div>
      <div className="relative flex-shrink-0">
        <img src={item.poster || 'https://placehold.coputed/96x128/1f2937/ffffff?text=?'} alt={item.title} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" />
      </div>
      <div className="flex flex-col justify-between flex-grow min-w-0 py-1">
        <div>
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1" style={{fontWeight: '600'}}>{item.title}</h3>
          {item.year && <p className="text-xs" style={{color: 'rgba(208, 189, 244, 0.8)'}}>{item.year}</p>}
          {/* Рейтинг под названием */}
          {item.rating && (
            <div className="flex gap-0.5 mt-1">
              {[...Array(5)].map((_, i) => (
                <Icon 
                  key={i} 
                  name="star" 
                  className={`w-3 h-3 ${i < item.rating ? 'text-[#a0d2eb]' : 'text-[#8458B3]/30'}`} style={i < item.rating ? {filter: 'drop-shadow(0 0 4px rgba(160, 210, 235, 0.5))'} : {}} 
                />
              ))}
            </div>
          )}
        </div>
        {item.reactions && item.reactions.length > 0 && (
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            {(() => {
              // Группируем реакции по emoji
              const groupedReactions = {};
              item.reactions.forEach(r => {
                if (!groupedReactions[r.emoji]) {
                  groupedReactions[r.emoji] = [];
                }
                groupedReactions[r.emoji].push(r);
              });
              
              // Показываем максимум 4 группы реакций
              const reactionGroups = Object.entries(groupedReactions).slice(0, 4);
              const totalGroups = Object.keys(groupedReactions).length;
              
               return reactionGroups.map(([emoji, reactions]) => (
                 <span 
                   key={emoji} 
                   className="text-[8px] hover:scale-110 transition-transform cursor-help relative group reaction-group"
                   title={reactions.map(r => r.username).join(', ')}
                 >
                   {emoji}
                   {reactions.length > 1 && <span className="ml-0.5 text-[7px] text-gray-400">×{reactions.length}</span>}
                 </span>
               ));
            })()}
            {(() => {
              const groupedReactions = {};
              item.reactions.forEach(r => {
                if (!groupedReactions[r.emoji]) {
                  groupedReactions[r.emoji] = [];
                }
                groupedReactions[r.emoji].push(r);
              });
              const totalGroups = Object.keys(groupedReactions).length;
               return totalGroups > 4 && <span className="text-[7px] text-gray-400 self-center">+{totalGroups - 4}</span>;
            })()}
          </div>
        )}
      </div>
       {!isViewingFriend && (
            <button onClick={(e) => onRemove(e, item)} className="absolute top-1 right-1 p-1.5 bg-red-600/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity self-start flex-shrink-0 z-10">
                <Icon name="trash" className="w-3 h-3 text-white" />
            </button>
       )}
    </div>
  );
}

function Column({ title, emoji, items, columnKey, isExpanded, onToggleExpand, isViewingFriend, onAddItem, ...handlers }) {
  // Определяем boardId на основе columnKey
  const boardId = columnKey.includes('wishlist') ? 'wishlist' : 'watched';
  const visibleItems = isExpanded ? items : items.slice(0, MEDIA_PER_COLUMN);
    
  const cardClass = boardId === 'wishlist' 
    ? 'bg-gradient-to-br from-[#a0d2eb]/15 to-[#8458B3]/25 border-2 border-[#a0d2eb]/40 backdrop-blur-xl' 
    : 'bg-gradient-to-br from-[#8458B3]/25 to-[#d0bdf4]/15 border-2 border-[#8458B3]/50 backdrop-blur-xl';
  
  return (
    <div className={`${cardClass} backdrop-blur-xl rounded-xl p-4 flex flex-col h-full elevation-1 board-column`} data-column-key={columnKey}>
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2 tracking-wide whitespace-nowrap" style={{textShadow: '0 1px 4px rgba(160, 210, 235, 0.25)', fontWeight: '800'}}>
                <span className="text-xl">{emoji}</span>
                <span>{title}</span>
            </h3>
            <div className="flex items-center gap-2">
                {!isViewingFriend && onAddItem && (
                    <button 
                        onClick={() => onAddItem(columnKey)}
                        className="p-1.5 bg-gradient-to-r from-[#8458B3] to-[#a0d2eb] hover:bg-gradient-to-r hover:from-[#a0d2eb] hover:to-[#8458B3] rounded-full transition-all hover:scale-105 shadow-lg" style={{boxShadow: '0 4px 12px rgba(132, 88, 179, 0.3)'}}>
                        <Icon name="plus" className="w-4 h-4 text-white"/>
                    </button>
                )}
            </div>
        </div>
        <div className="space-y-2 flex-grow min-h-[150px]">
            {visibleItems.map(it => <MediaCard key={it.id} item={it} isViewingFriend={isViewingFriend} boardId={boardId} {...handlers} />)}
        </div>
        {items.length > MEDIA_PER_COLUMN && (
          <button onClick={() => onToggleExpand(columnKey)} className="w-full text-center mt-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#8458B3] to-[#a0d2eb] hover:bg-gradient-to-r hover:from-[#a0d2eb] hover:to-[#8458B3] rounded-lg flex items-center justify-center gap-1 transition-all hover:scale-105 shadow-lg" style={{boxShadow: '0 2px 8px rgba(132, 88, 179, 0.3)', fontWeight: '600'}}>
            {isExpanded ? 'Свернуть' : `Показать еще ${items.length - MEDIA_PER_COLUMN}`}
            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-3 h-3" />
          </button>
        )}
    </div>
  );
}

function MediaDetailsModal({ item, onClose, onUpdate, onReact, isViewingFriend, user, onTriggerAnimation }) {
  if (!item) return null;
  const userReaction = (item.reactions || []).find(r => r.user_id === user?.id);
  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const [previousRating, setPreviousRating] = useState(item?.rating || 0);

  // Обработка изменения рейтинга
  const handleRatingChange = (rating) => {
    setPreviousRating(item.rating || 0);
    onUpdate(item, { rating });
    
    // Если поставили 5 звезд и раньше было меньше 5
    if (rating === 5 && (item.rating || 0) < 5) {
      // Установить флаг, что нужна анимация при закрытии
      sessionStorage.setItem(`pending-animation-${item.id}`, 'true');
    }
  };

  // Обработка завершения анимации
  const handleAnimationComplete = () => {
    setTriggerAnimation(false);
  };

  // Обработка закрытия модального окна
  const handleClose = () => {
    const needsAnimation = sessionStorage.getItem(`pending-animation-${item.id}`) === 'true';
    
    if (needsAnimation) {
      sessionStorage.removeItem(`pending-animation-${item.id}`);
      
      // Ждем 500ms ПОСЛЕ закрытия модалки
      setTimeout(() => {
        if (onTriggerAnimation) {
          onTriggerAnimation(item);
        } else {
          setTriggerAnimation(true);
        }
      }, 500); // Полсекунды задержки после закрытия
    }
    
    onClose();
  };

  return (
    <>
      {/* Эпическая анимация */}
      {triggerAnimation && (
        <EpicFiveStarAnimation
          posterUrl={item.poster}
          cardId={item.id}
          onComplete={handleAnimationComplete}
        />
      )}
      
      {/* Модальное окно */}
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={handleClose}>
      <div className="bg-[#1a0f2e]/95 backdrop-blur-xl border border-[#8458B3]/50 modal-bg rounded-2xl p-6 w-full max-w-md border border-purple-500/30 max-h-[90vh] overflow-y-auto elevation-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{item.title}</h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-800 rounded-lg"><Icon name="x" className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          {!isViewingFriend ? (
              <Fragment>
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Рейтинг:</p>
                    <StarRating value={item.rating || 0} onChange={handleRatingChange} />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Отзыв:</label>
                    <textarea defaultValue={item.review || ''} onBlur={(e) => onUpdate(item, { review: e.target.value })} className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white mt-1" rows="4" placeholder="Ваши впечатления..."/>
                  </div>
              </Fragment>
          ) : (
             <Fragment>
                {item.rating && <div><p className="text-gray-400 text-sm mb-2">Рейтинг от {item.owner.username}:</p><div className="flex gap-1">{[...Array(5)].map((_, i) => (<Icon key={i} name="star" className={`w-6 h-6 ${i < item.rating ? 'text-[#a0d2eb]' : 'text-[#8458B3]/30'}`} style={i < item.rating ? {filter: 'drop-shadow(0 0 4px rgba(160, 210, 235, 0.5))'} : {}} />))}</div></div>}
                {item.review && <div><p className="text-gray-400 text-sm mb-1">Отзыв от {item.owner.username}:</p><p className="text-white bg-gray-800 p-3 rounded-lg border border-gray-700">{item.review}</p></div>}
                {!item.rating && !item.review && <p className="text-gray-400 italic">Пользователь не оставил отзыва.</p>}
             </Fragment>
          )}

          <div>
            <p className="text-gray-400 text-sm mb-2">Ваша реакция:</p>
            <div className="flex flex-wrap gap-2">
              {REACTION_EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  data-reaction-emoji={emoji}
                  onClick={() => onReact(item, emoji)} 
                  className={`text-2xl reaction-button p-1 rounded-full ${userReaction?.emoji === emoji ? 'bg-purple-500/30' : 'hover:bg-gray-700/50'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          {item.reactions && item.reactions.length > 0 && (
            <div>
              <p className="text-gray-400 text-sm mb-2">Все реакции:</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  // Группируем реакции по emoji
                  const groupedReactions = {};
                  item.reactions.forEach(r => {
                    if (!groupedReactions[r.emoji]) {
                      groupedReactions[r.emoji] = [];
                    }
                    groupedReactions[r.emoji].push(r);
                  });
                  
                  return Object.entries(groupedReactions).map(([emoji, reactions]) => (
                    <div 
                      key={emoji} 
                      className="flex items-center gap-1 bg-[#e5eaf5]/20 px-3 py-1 rounded-full group cursor-pointer hover:bg-gray-700 transition-colors reaction-button" 
                      title={`${reactions.map(r => r.username).join(', ')}`}
                    >
                      <div className="flex -space-x-1">
                        {reactions.slice(0, 3).map((reaction, idx) => (
                          <Avatar 
                            key={idx} 
                            src={reaction.avatar} 
                            size="sm" 
                            className="w-6 h-6 border-2 border-gray-800" 
                          />
                        ))}
                        {reactions.length > 3 && (
                          <div className="w-6 h-6 bg-gray-600 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs text-white">
                            +{reactions.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-xl">{emoji}</span>
                      {reactions.length > 1 && <span className="text-sm text-gray-400">×{reactions.length}</span>}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Кнопка трейлера */}
          <div className="flex gap-2 mt-4">
            <a 
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' trailer')}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-[#dc2626] to-[#991b1b] border-2 border-[#a0d2eb] text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg" style={{boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'}}>
              <Icon name="youtube" className="w-6 h-6" />
              Трейлер
            </a>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function ActivityFeed({ token, boardType = 'media', onNavigateToUser }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivities = async () => {
            if (!token) return;
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/api/friends/activity?type=${boardType}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setActivities(data.activities);
                }
            } catch (err) {
                console.error("Failed to fetch activities", err);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
        const interval = setInterval(fetchActivities, 60000);
        return () => clearInterval(interval);
    }, [token]);
    
    const boardTitles = { wishlist: 'Хочу посмотреть', watched: 'Посмотрел' };
    const mediaTypes = { movie: 'фильм', tv: 'сериал'};

    const formatActivity = (act) => {
        const { username, action_type, details, user_id } = act;
        const mediaName = <span className="font-bold text-purple-300">{details.title}</span>;
        const mediaType = mediaTypes[details.mediaType] || 'медиа';
        const clickableUsername = (
            <button 
                onClick={() => onNavigateToUser && onNavigateToUser(user_id)}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer font-semibold"
            >
                {username}
            </button>
        );
        
        switch (action_type) {
            case 'add_media':
                return <>{clickableUsername} добавил {mediaType} {mediaName} в <span className="italic">{boardTitles[details.board]}</span></>;
            case 'complete_media':
                return <><span className="text-green-400 font-semibold">{clickableUsername}</span> посмотрел {mediaType} {mediaName}! 🎉</>;
            case 'move_media':
                return <>{clickableUsername} вернул {mediaType} {mediaName} в <span className="italic">"{boardTitles.wishlist}"</span></>;
             case 'remove_media':
                return <>{clickableUsername} удалил {mediaName}</>;
            default:
                return <>{clickableUsername} {action_type}</>;
        }
    };
    
    return (
        <div className="bg-gradient-to-br from-[#8458B3]/30 to-[#a28089]/25 backdrop-blur-xl rounded-xl border border-[#8458B3]/40 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Активность друзей</h3>
            {loading ? (
                <div className="w-full flex items-center justify-center p-10"><Icon name="loader" className="w-8 h-8 text-purple-400"/></div>
            ) : activities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activities.map(act => (
                        <div key={act.id} className="text-sm text-gray-300 p-4 bg-[#1a0f2e]/60 rounded-lg border border-[#8458B3]/30 hover:border-[#a0d2eb] hover:-translate-y-1 transition-all">
                            <p>{formatActivity(act)}</p>
                            <div className="text-xs text-gray-500 mt-2 text-right">{new Date(act.created_at).toLocaleString('ru-RU')}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 text-center">Пока нет активности от ваших друзей.</p>
            )}
        </div>
    );
};


// --- Главный компонент приложения ---

function MovieApp() {
  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState({ 
    movies: { 
      wishlist: [], 
      watched: [],
      color: 'from-blue-500/20 to-cyan-500/20',
      borderColor: 'border-blue-500/30',
      accentColor: '#3B82F6'
    }, 
    tv: { 
      wishlist: [], 
      watched: [],
      color: 'from-orange-500/20 to-amber-500/20',
      borderColor: 'border-orange-500/30',
      accentColor: '#F59E0B'
    } 
  });
  const [query, setQuery] = useState('');
  const [type, setType] = useState('movie');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [targetColumnForAdd, setTargetColumnForAdd] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [theme, setTheme] = useState('default');
  const [viewingUser, setViewingUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserHub, setShowUserHub] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const dragItem = useRef(null);
  const [expandedColumns, setExpandedColumns] = useState({});
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [friendshipStatus, setFriendshipStatus] = useState('none');
  const [userNickname, setUserNickname] = useState('');
  const [animatingCard, setAnimatingCard] = useState(null);
  const [confirmingAddFriend, setConfirmingAddFriend] = useState(null);
  const [confirmingDeleteFriend, setConfirmingDeleteFriend] = useState(null);
  const [profileData, setProfileData] = useState({ username: '', bio: '', currentPassword: '', newPassword: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');
  
  // Состояния для drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  
  const loadBoards = useCallback(async (userId = null) => {
    if (!token) return;
    try {
      const url = userId ? `${API_URL}/api/user/${userId}/media/boards` : `${API_URL}/api/user/media/boards`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      
      if (userId) {
        setViewingUser(data.user);
        setFriendshipStatus(data.friendship || 'none');
        setUserNickname(data.nickname || '');
      } else {
        setViewingUser(null);
        setFriendshipStatus('none');
        setUserNickname('');
      }
      
      if (res.ok && data.boards) {
        setBoards(data.boards);
      } else {
        if(res.status === 401 || res.status === 403) handleLogout();
      }
    } catch (err) {
      console.error("Ошибка загрузки досок:", err);
    }
  }, [token]);

  const loadFriends = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
        setFriendRequests(data.requests || []);
        setSentRequests(data.sentRequests || []);
      }
    } catch (err) { console.error('Ошибка загрузки друзей:', err); }
  }, [token]);
  
  const loadAllUsers = useCallback(async (query = '') => {
      const url = query ? `${API_URL}/api/users?q=${encodeURIComponent(query)}` : `${API_URL}/api/users`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
          const data = await response.json();
          setAllUsers(data.users || []);
      }
  }, [token]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setTheme(parsedUser.theme || 'default');
        setProfileData({ username: parsedUser.username || '', bio: parsedUser.bio || '', currentPassword: '', newPassword: '' });
        loadBoards();
        loadFriends();
    } else {
        window.location.href = '/index.html'; 
    }
  }, [token, loadBoards, loadFriends]);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const handleSearch = async (q) => {
    setQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/media/search?q=${encodeURIComponent(q)}&type=${type}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err) {
      console.error("Ошибка поиска:", err);
    } finally {
      setSearching(false);
    }
  };

  const addItem = async (item, board = 'wishlist') => {
    await fetch(`${API_URL}/api/user/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item, board })
    });
    await loadBoards();
    setShowSearch(false);
    setQuery('');
    setTargetColumnForAdd(null);
  };

  const handleAddToColumn = (columnKey) => {
    // Определяем тип медиа по columnKey
    const mediaType = columnKey.startsWith('movie:') ? 'movie' : 'tv';
    setType(mediaType);
    setTargetColumnForAdd(columnKey);
    setShowSearch(true);
  };

  const updateItem = async (item, updates) => {
    await fetch(`${API_URL}/api/user/media/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates)
    });
    await loadBoards(viewingUser?.id);
    setSelectedMedia(prev => (prev && prev.id === item.id) ? { ...prev, ...updates } : prev);
  };

  // Обновление карточки с голографическим эффектом на постере
  const updateCardClass = (cardId) => {
    setTimeout(() => {
      const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
      if (cardElement) {
        // Найти постер внутри карточки
        const posterImg = cardElement.querySelector('img');
        if (posterImg) {
          posterImg.classList.add('legendary-poster');
        }
      }
    }, 100);
  };
  
  const removeItem = async (e, item) => {
    e.stopPropagation();
    if (confirm(`Вы уверены, что хотите удалить "${item.title}"?`)) {
      await fetch(`${API_URL}/api/user/media/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await loadBoards();
    }
  };

  const reactToItem = async (item, emoji) => {
    const userReaction = (item.reactions || []).find(r => r.user_id === user?.id);
    
    // Если пользователь кликает на свою текущую реакцию, удаляем её
    if (userReaction && userReaction.emoji === emoji) {
      await fetch(`${API_URL}/api/media/${item.id}/reactions`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
    } else {
      // Добавляем анимацию к кнопке реакции
      const reactionButton = document.querySelector(`[data-reaction-emoji="${emoji}"]`);
      if (reactionButton) {
        reactionButton.classList.add('reaction-add-animation');
        setTimeout(() => {
          reactionButton.classList.remove('reaction-add-animation');
        }, 600);
      }
      
      await fetch(`${API_URL}/api/media/${item.id}/reactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
    }
    
    await loadBoards(viewingUser?.id);
    try {
      const res = await fetch(`${API_URL}/api/user/media/boards`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.boards) return;
      const allItems = [
        ...(data.boards.movies?.wishlist || []),
        ...(data.boards.movies?.watched || []),
        ...(data.boards.tv?.wishlist || []),
        ...(data.boards.tv?.watched || [])
      ];
      const updatedItem = allItems.find(i => i.id === item.id);
      if (updatedItem) {
        setSelectedMedia(prev => (prev && prev.id === item.id) ? updatedItem : prev);
      }
    } catch (e) {
      // swallow; non-critical UI update
      console.error(e);
    }
  };

  const friendAction = async (friendId, action) => {
    try {
      if (action === 'request') {
        await fetch(`${API_URL}/api/friends/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ friendId }) });
      } else if (action === 'accept') {
        await fetch(`${API_URL}/api/friends/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ friendId }) });
      } else if (action === 'reject') {
        await fetch(`${API_URL}/api/friends/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ friendId }) });
      } else if (action === 'delete') {
        await fetch(`${API_URL}/api/friends/${friendId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      }
      await loadFriends();
      if (viewingUser && viewingUser.id === friendId) await loadBoards(friendId);
    } catch (err) {
      console.error('Ошибка действия с другом:', err);
    } finally {
      setConfirmingAddFriend(null);
      setConfirmingDeleteFriend(null);
    }
  };

  const updateNickname = async (friendId, nickname) => {
    try {
      await fetch(`${API_URL}/api/friends/${friendId}/nickname`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ nickname }) });
      await loadFriends();
    } catch (e) { console.error('Ошибка изменения метки:', e); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setUploadingAvatar(true);
        const res = await fetch(`${API_URL}/api/profile/avatar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ avatar: reader.result }) });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        }
      } catch (err) { console.error('Ошибка загрузки аватара:', err); }
      finally { setUploadingAvatar(false); }
    };
    reader.readAsDataURL(file);
  };

  const updateProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ username: profileData.username, bio: profileData.bio, theme, currentPassword: profileData.currentPassword, newPassword: profileData.newPassword }) });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setTheme(data.user.theme || 'default');
        setShowProfile(false);
      }
    } catch (err) {
      console.error('Ошибка обновления профиля:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/index.html';
  };
  
  const onDragStart = (e, item) => {
    if(viewingUser) return;
    dragItem.current = { item };
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    
    // Определяем целевую колонку для анимации на основе mediaType и текущей board
    // Целевая колонка = ПРОТИВОПОЛОЖНАЯ от той, где сейчас карточка (куда можно перенести)
    console.log('Перетаскиваемая карточка:', item);
    console.log('mediaType:', item.mediaType, 'board:', item.board);
    console.log('Полная структура item:', JSON.stringify(item, null, 2));
    
    let targetColumnKey = '';
    if (item.mediaType === 'movie') {
      // Если карточка в wishlist, цель - watched, и наоборот
      targetColumnKey = item.board === 'wishlist' ? 'movie:watched' : 'movie:wishlist';
    } else if (item.mediaType === 'tv') {
      // Если карточка в wishlist, цель - watched, и наоборот
      targetColumnKey = item.board === 'wishlist' ? 'tv:watched' : 'tv:wishlist';
    }
    
    console.log('Определена целевая колонка:', targetColumnKey);
    console.log('Логика: карточка из', item.board, '→ цель', targetColumnKey);
    
    // Добавляем класс к ЦЕЛЕВОЙ КОЛОНКЕ с небольшой задержкой
    if (targetColumnKey) {
      console.log('Ищем целевую колонку:', targetColumnKey);
      
      // Небольшая задержка чтобы DOM успел обновиться
      setTimeout(() => {
        const targetColumn = document.querySelector(`[data-column-key="${targetColumnKey}"]`);
        console.log('Найдена целевая колонка:', targetColumn);
        if (targetColumn) {
          targetColumn.classList.add('drag-over-column');
          setDragOverColumn(targetColumn);
          console.log('Добавлен класс drag-over-column к:', targetColumn);
        } else {
          console.error('Целевая колонка не найдена!');
          // Попробуем найти все колонки для отладки
          const allColumns = document.querySelectorAll('[data-column-key]');
          console.log('Все найденные колонки:', allColumns);
          allColumns.forEach(col => {
            console.log('Колонка:', col.getAttribute('data-column-key'), col);
          });
        }
      }, 10);
    }
    
    setTimeout(() => {
      e.currentTarget.classList.add('dragging-card');
    }, 0);
  };

  const onDragEnd = (e) => {
    console.log('onDragEnd: очищаем все анимации');
    
    // Убираем класс dragging-card с перетаскиваемой карточки
    document.querySelectorAll('.dragging-card').forEach(el => el.classList.remove('dragging-card'));
    dragItem.current = null;
    setIsDragging(false);
    setDragOverColumn(null);
    
    // Убираем все drag-over-column классы
    document.querySelectorAll('.drag-over-column').forEach(el => {
      el.classList.remove('drag-over-column');
      console.log('Удален класс drag-over-column с:', el);
    });
    document.querySelectorAll('.board-column').forEach(col => {
      col.removeAttribute('data-position');
    });
  };

  const toggleColumnExpansion = (columnKey) => {
    setExpandedColumns(prev => ({...prev, [columnKey]: !prev[columnKey]}));
  };

  const onDragOver = (e) => e.preventDefault();
  const onDragEnterColumn = (e) => {
    e.preventDefault();
    // Просто предотвращаем стандартное поведение
    // Анимация управляется через onDragStart
  };

  const onDragLeaveColumn = (e) => {
    // Просто предотвращаем стандартное поведение
    // Анимация управляется через onDragStart
  };
  
  const onDrop = async (e, targetColumnKey) => {
    e.preventDefault();
    if (!dragItem.current || viewingUser) return;
    
    console.log('onDrop: карточка сброшена в колонку:', targetColumnKey);
    
    // Очищаем состояние drag & drop
    setIsDragging(false);
    setDragOverColumn(null);
    
    const { item } = dragItem.current;
    const [targetMedia, targetBoard] = targetColumnKey.split(':');

    if (item.mediaType !== targetMedia) return;
    if (item.board === targetBoard) return;
    
    await updateItem(item, { board: targetBoard });
    
    // Очищаем все классы после успешного drop
    document.querySelectorAll('.drag-over-column').forEach(el => {
      el.classList.remove('drag-over-column');
      console.log('onDrop: удален класс drag-over-column с:', el);
    });
    document.querySelectorAll('.board-column').forEach(col => {
      col.removeAttribute('data-position');
    });
  };
  
  const movies = boards.movies || { wishlist: [], watched: [] };
  const tv = boards.tv || { wishlist: [], watched: [] };
  
  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#1a1625] to-[#2d1b4e] ${theme} flex flex-col`}>
      <header className="bg-[#1a0f2e]/85 backdrop-blur-xl border-b border-[#8458B3]/30 sticky top-0 z-50 flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <a href="/index.html" className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d0bdf4] via-[#a0d2eb] to-[#8458B3] active:scale-95 transition-transform cursor-pointer">🎮 GameTracker</a>
              {/* Красивая разделительная линия */}
              <div className="h-8 w-px bg-gradient-to-b from-transparent via-[#a0d2eb]/80 to-transparent opacity-80 ml-2"></div>
              <a href="./movies.html" className="inline-flex items-center gap-2 active:scale-95 transition-transform">
                <svg className="w-7 h-7" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <defs><linearGradient id="camGradHeaderReact" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d0bdf4"/><stop offset="100%" stopColor="#8458B3"/></linearGradient></defs>
                  <path fill="url(#camGradHeaderReact)" d="M4 7a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-.764l3.553 2.132A1 1 0 0 0 22 14.5v-5a1 1 0 0 0-1.447-.868L17 10.764V10a3 3 0 0 0-3-3H11l-.553-1.106A2 2 0 0 0 8.658 5H6a2 2 0 0 0-1.789 1.106L4 7Zm7 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                </svg>
                <span className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d0bdf4] via-[#a0d2eb] to-[#8458B3]">MovieTracker</span>
              </a>
            </div>
            {user && (
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-[#8458B3]/25 to-[#a0d2eb]/20 rounded-lg border border-[#a0d2eb]/40">
                        <Avatar src={viewingUser ? viewingUser.avatar : user.avatar} size="sm" />
                        <span className="text-white font-semibold text-sm md:text-base block">{viewingUser ? (userNickname || viewingUser.username) : user.username}</span>
                        {viewingUser && userNickname && <span className="text-xs text-gray-400">@{viewingUser.username}</span>}
                    </div>
                    {viewingUser ? (
                       <Fragment>
                         {friendshipStatus === 'friends' && (
                           <button onClick={() => setConfirmingDeleteFriend(viewingUser)} className="p-2 bg-blue-500/20 hover:bg-red-500/20 rounded-lg border border-blue-500/30 hover:border-red-500/30"><Icon name="userCheck" className="w-4 h-4 md:w-5 md:h-5 text-green-400" /></button>
                         )}
                         {friendshipStatus === 'request_sent' && (
                           <button onClick={() => friendAction(viewingUser.id, 'reject')} className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30"><Icon name="userClock" className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" /></button>
                         )}
                         {friendshipStatus === 'request_received' && (
                           <div className="flex gap-2">
                             <button onClick={() => setConfirmingAddFriend(viewingUser)} className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg border border-green-500/30"><Icon name="check" className="w-4 h-4 md:w-5 md:h-5 text-green-400" /></button>
                             <button onClick={() => friendAction(viewingUser.id, 'reject')} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30"><Icon name="x" className="w-4 h-4 md:w-5 md:h-5 text-red-400" /></button>
                           </div>
                         )}
                         {friendshipStatus === 'none' && (
                           <button onClick={() => friendAction(viewingUser.id, 'request')} className="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg border border-purple-500/30"><Icon name="userPlus" className="w-4 h-4 md:w-5 md:h-5 text-purple-400" /></button>
                         )}
                         <button onClick={() => { setViewingUser(null); loadBoards(); }} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700">
                           <Icon name="x" className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                         </button>
                       </Fragment>
                    ) : (
                       <Fragment>
                           <button onClick={() => setShowStatistics(true)} className="p-2 hover:bg-gray-800 rounded-lg border border-purple-500/30" title="Статистика фильмов">
                               <Icon name="barChart" className="w-4 h-4 md:w-5 md:h-5 text-[#d0bdf4] hover:text-[#a0d2eb] hover:scale-110 transition-all header-icon" />
                           </button>
                           <button onClick={() => setShowProfile(true)} className="p-2 hover:bg-gray-800 rounded-lg border border-purple-500/30">
                               <Icon name="settings" className="w-4 h-4 md:w-5 md:h-5 text-[#d0bdf4] hover:text-[#a0d2eb] hover:scale-110 transition-all header-icon" />
                           </button>
                           <button onClick={() => { setShowUserHub(true); loadAllUsers(); }} className="p-2 hover:bg-gray-800 rounded-lg border border-purple-500/30 relative">
                               <Icon name="users" className="w-4 h-4 md:w-5 md:h-5 text-[#d0bdf4] hover:text-[#a0d2eb] hover:scale-110 transition-all header-icon" />
                               {friendRequests.length > 0 && <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white badge-notification"></span>}
                           </button>
                       </Fragment>
                    )}
                    <NotificationsPanel 
                      token={localStorage.getItem('token')} 
                      onNavigateToUser={(userId) => {
                        setViewingUser({ id: userId });
                        loadBoards(token, userId);
                      }}
                      onNavigateToGame={(gameId) => {
                        // Можно добавить логику для перехода к конкретной игре
                        console.log('Navigate to game:', gameId);
                      }}
                    />
                </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-6 space-y-8">
        {!viewingUser && (
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-purple-500/30 p-4">
                <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8458B3] to-[#a0d2eb] hover:from-[#a0d2eb] hover:to-[#8458B3] rounded-lg transition-all border border-[#a0d2eb]/30 shadow-lg hover:scale-105" style={{boxShadow: '0 4px 12px rgba(132, 88, 179, 0.3)'}}>
                    <Icon name="search" className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-semibold text-sm md:text-base" style={{textShadow: 'none'}}>Поиск фильмов/сериалов</span>
                </button>
            </div>
        )}
        
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-8">
            <div className="hidden lg:block absolute left-1/2 -ml-px top-0 h-full bg-gradient-to-b from-transparent via-[#a0d2eb]/30 to-transparent w-px"></div>
            <div className="space-y-4">
                <h2 className="text-center text-3xl font-semibold tracking-wider text-white mb-4" style={{textShadow: '0 0 15px rgba(160, 210, 235, 0.3), 0 0 30px rgba(132, 88, 179, 0.2)', fontWeight: '700', letterSpacing: '0.05em'}}>Фильмы</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" onDragOver={onDragOver}>
                    <div onDrop={(e) => onDrop(e, 'movie:wishlist')} onDragEnter={onDragEnterColumn} onDragLeave={onDragLeaveColumn}>
                        <Column title="Хочу посмотреть" emoji="🎬" items={movies.wishlist} columnKey="movie:wishlist" isExpanded={!!expandedColumns['movie:wishlist']} onToggleExpand={toggleColumnExpansion} onSelect={setSelectedMedia} onRemove={removeItem} onDragStart={onDragStart} onDragEnd={onDragEnd} isViewingFriend={!!viewingUser} onAddItem={handleAddToColumn} />
                    </div>
                    <div onDrop={(e) => onDrop(e, 'movie:watched')} onDragEnter={onDragEnterColumn} onDragLeave={onDragLeaveColumn}>
                        <Column title="Посмотрел" emoji="🍿" items={movies.watched} columnKey="movie:watched" isExpanded={!!expandedColumns['movie:watched']} onToggleExpand={toggleColumnExpansion} onSelect={setSelectedMedia} onRemove={removeItem} onDragStart={onDragStart} onDragEnd={onDragEnd} isViewingFriend={!!viewingUser} onAddItem={handleAddToColumn} />
                    </div>
                </div>
            </div>
             <div className="space-y-4">
                <h2 className="text-center text-3xl font-semibold tracking-wider text-white mb-4" style={{textShadow: '0 0 15px rgba(160, 210, 235, 0.3), 0 0 30px rgba(132, 88, 179, 0.2)', fontWeight: '700', letterSpacing: '0.05em'}}>Сериалы</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" onDragOver={onDragOver}>
                    <div onDrop={(e) => onDrop(e, 'tv:wishlist')} onDragEnter={onDragEnterColumn} onDragLeave={onDragLeaveColumn}>
                        <Column title="Хочу посмотреть" emoji="📺" items={tv.wishlist} columnKey="tv:wishlist" isExpanded={!!expandedColumns['tv:wishlist']} onToggleExpand={toggleColumnExpansion} onSelect={setSelectedMedia} onRemove={removeItem} onDragStart={onDragStart} onDragEnd={onDragEnd} isViewingFriend={!!viewingUser} onAddItem={handleAddToColumn} />
                    </div>
                    <div onDrop={(e) => onDrop(e, 'tv:watched')} onDragEnter={onDragEnterColumn} onDragLeave={onDragLeaveColumn}>
                        <Column title="Посмотрел" emoji="✅" items={tv.watched} columnKey="tv:watched" isExpanded={!!expandedColumns['tv:watched']} onToggleExpand={toggleColumnExpansion} onSelect={setSelectedMedia} onRemove={removeItem} onDragStart={onDragStart} onDragEnd={onDragEnd} isViewingFriend={!!viewingUser} onAddItem={handleAddToColumn} />
                    </div>
                </div>
            </div>
        </div>
        
        {!viewingUser && <ActivityFeed 
          token={token} 
          boardType="media" 
          onNavigateToUser={(userId) => {
            console.log('Navigating to user:', userId);
            loadBoards(userId);
          }}
        />}

      </main>

      {showProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowProfile(false)}>
          <div className="bg-[#1a0f2e]/95 backdrop-blur-xl border border-[#8458B3]/50 modal-bg rounded-2xl p-6 w-full max-w-md border border-purple-500/30 max-h-[90vh] overflow-y-auto elevation-3 modal-bg" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4" style={{textShadow: '0 2px 4px rgba(160, 210, 235, 0.3)'}}>Настройки профиля</h2>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar src={user?.avatar} size="xl" />
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#d0bdf4] to-[#8458B3] hover:bg-purple-600 text-white rounded-lg transition-all disabled:opacity-50">
                  {uploadingAvatar ? <Icon name="loader" className="w-4 h-4" /> : <Icon name="upload" className="w-4 h-4" />} {uploadingAvatar ? 'Загрузка...' : 'Загрузить аватар'}
                </button>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Имя пользователя:</label>
                <input type="text" value={profileData.username} onChange={(e) => setProfileData({ ...profileData, username: e.target.value })} placeholder={user?.username} className="w-full px-4 py-2 bg-[#8458B3]/15 border border-[#a0d2eb]/30 rounded-lg focus:border-[#a0d2eb] focus:outline-none focus:shadow-[0_0_0_3px_rgba(160,210,235,0.1)] text-white mt-1" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">О себе:</label>
                <textarea value={profileData.bio} onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })} placeholder={user?.bio || 'Расскажи о себе...'} className="w-full px-4 py-2 bg-[#8458B3]/15 border border-[#a0d2eb]/30 rounded-lg focus:border-[#a0d2eb] focus:outline-none focus:shadow-[0_0_0_3px_rgba(160,210,235,0.1)] text-white mt-1" rows="3" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Тема оформления:</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setTheme('default')} className={`flex-1 py-2 rounded-lg text-sm ${theme === 'default' ? 'bg-purple-500 text-white' : 'bg-gray-800'}`}>Стандартная</button>
                  <button onClick={() => setTheme('liquid-eye')} className={`flex-1 py-2 rounded-lg text-sm ${theme === 'liquid-eye' ? 'bg-white text-black' : 'bg-gray-800'}`}>Liquid Eye</button>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Текущий пароль (для изменения):</label>
                <input type="password" value={profileData.currentPassword} onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })} className="w-full px-4 py-2 bg-[#8458B3]/15 border border-[#a0d2eb]/30 rounded-lg focus:border-[#a0d2eb] focus:outline-none focus:shadow-[0_0_0_3px_rgba(160,210,235,0.1)] text-white mt-1" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Новый пароль:</label>
                <input type="password" value={profileData.newPassword} onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })} className="w-full px-4 py-2 bg-[#8458B3]/15 border border-[#a0d2eb]/30 rounded-lg focus:border-[#a0d2eb] focus:outline-none focus:shadow-[0_0_0_3px_rgba(160,210,235,0.1)] text-white mt-1" />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <button onClick={handleLogout} className="w-full py-2 bg-red-600 border-2 border-[#a28089] hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center gap-2">
                  <Icon name="logout" className="w-4 h-4" />
                  Выйти из аккаунта
                </button>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={updateProfile} className="flex-1 py-2 bg-gradient-to-r from-[#8458B3] to-[#d0bdf4] text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600">Сохранить</button>
                <button onClick={() => setShowProfile(false)} className="flex-1 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserHub && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowUserHub(false)}>
          <div className="bg-[#1a0f2e]/95 backdrop-blur-xl border border-[#8458B3]/50 modal-bg rounded-2xl p-6 w-full max-w-3xl border border-purple-500/30 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white">Сообщество</h2>
              <button onClick={() => setShowUserHub(false)} className="p-2 hover:bg-gray-800 rounded-lg"><Icon name="x" className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto">
              {friendRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Запросы в друзья ({friendRequests.length})</h3>
                  <div className="space-y-3">
                    {friendRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <Avatar src={req.avatar} size="md" />
                        <div className="flex-1 cursor-pointer" onClick={() => { loadBoards(req.id); setShowUserHub(false); }}>
                          <p className="text-white font-semibold">{req.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmingAddFriend(req)} className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg"><Icon name="check" className="w-5 h-5 text-green-400" /></button>
                          <button onClick={() => friendAction(req.id, 'reject')} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg"><Icon name="x" className="w-5 h-5 text-red-400" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {friends.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Мои друзья ({friends.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {friends.map(friend => (
                      <div key={friend.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg group">
                        <Avatar src={friend.avatar} size="md" />
                        <div className="flex-1 cursor-pointer" onClick={() => { loadBoards(friend.id); setShowUserHub(false); }}>
                          <p className="text-white font-semibold">{friend.nickname || friend.username}</p>
                          {friend.nickname && <p className="text-xs text-gray-400">@{friend.username}</p>}
                        </div>
                        <button onClick={() => setConfirmingDeleteFriend(friend)} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-5 h-5 text-red-400" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Все пользователи</h3>
                <input type="text" value={userSearchQuery} onChange={(e) => { setUserSearchQuery(e.target.value); loadAllUsers(e.target.value); }} placeholder="Поиск пользователей..." className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allUsers.map(u => {
                    const isFriend = friends.some(f => f.id === u.id);
                    const isRequestReceived = friendRequests.some(r => r.id === u.id);
                    const isRequestSent = sentRequests.includes(u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <Avatar src={u.avatar} size="md" />
                        <div className="flex-1 cursor-pointer" onClick={() => { loadBoards(u.id); setShowUserHub(false); }}>
                          <p className="text-white font-semibold">{u.username}</p>
                        </div>
                        {isFriend ? (
                          <button onClick={() => setConfirmingDeleteFriend(u)} className="p-2 bg-green-500/20 hover:bg-red-500/20 rounded-lg transition-all"><Icon name="userCheck" className="w-5 h-5 text-green-400" /></button>
                        ) : isRequestReceived ? (
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmingAddFriend(u)} className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg"><Icon name="check" className="w-5 h-5 text-green-400" /></button>
                            <button onClick={() => friendAction(u.id, 'reject')} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg"><Icon name="x" className="w-5 h-5 text-red-400" /></button>
                          </div>
                        ) : isRequestSent ? (
                          <button onClick={() => friendAction(u.id, 'reject')} className="p-2 bg-yellow-500/20 hover:bg-red-500/20 rounded-lg"><Icon name="userClock" className="w-5 h-5 text-yellow-400" /></button>
                        ) : (
                          <button onClick={() => friendAction(u.id, 'request')} className="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg"><Icon name="userPlus" className="w-5 h-5 text-purple-400" /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmingAddFriend && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4" onClick={() => setConfirmingAddFriend(null)}>
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-purple-500/30 elevation-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Добавить в друзья {confirmingAddFriend.username}?</h2>
            <div className="flex gap-2">
              <button onClick={() => friendAction(confirmingAddFriend.id, 'accept')} className="flex-1 py-2 bg-green-600 text-white rounded-lg">Добавить</button>
              <button onClick={() => setConfirmingAddFriend(null)} className="flex-1 py-2 bg-gray-800 text-white rounded-lg">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {confirmingDeleteFriend && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4" onClick={() => setConfirmingDeleteFriend(null)}>
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-purple-500/30 elevation-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Удалить из друзей {confirmingDeleteFriend.username}?</h2>
            <div className="flex gap-2">
              <button onClick={() => friendAction(confirmingDeleteFriend.id, 'delete')} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Удалить</button>
              <button onClick={() => setConfirmingDeleteFriend(null)} className="flex-1 py-2 bg-gray-800 text-white rounded-lg">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-[#1a0f2e]/95 backdrop-blur-xl border border-[#8458B3]/50 modal-bg rounded-lg shadow-2xl border border-purple-500/30 p-4 z-50 w-full max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <input type="text" value={query} onChange={e => handleSearch(e.target.value)} placeholder="Поиск TMDB..." className="flex-1 px-4 py-2 bg-[#8458B3]/20 border-2 border-[#a0d2eb]/40 rounded-lg focus:outline-none focus:shadow-[0_0_20px_rgba(160,210,235,0.5)] focus:border-[#a0d2eb] text-white text-sm" autoFocus />
              <select className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white" value={type} onChange={e => {setType(e.target.value); handleSearch(query)}}>
                <option value="movie">Фильмы</option>
                <option value="tv">Сериалы</option>
              </select>
              <button onClick={() => { setShowSearch(false); setQuery(''); setSearchResults([]); }} className="p-2 hover:bg-gray-700 rounded-lg">
                <Icon name="x" className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {searching ? (
                <div className="flex items-center justify-center py-8"><Icon name="loader" className="w-6 h-6 text-purple-400" /></div>
              ) : searchResults.length > 0 ? (
                searchResults.map(it => (
                  <div key={`${it.mediaType}-${it.tmdbId}`} className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded-lg">
                    <img src={it.poster || 'https://placehold.co/40x56/1f2937/ffffff?text=?'} alt={it.title} className="w-10 h-14 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{it.title} ({it.year})</p>
                      <p className="text-xs text-gray-400 truncate">{it.overview}</p>
                    </div>
                    <button onClick={() => addItem(it, targetColumnForAdd ? targetColumnForAdd.split(':')[1] : 'wishlist')} className="p-2 bg-gradient-to-r from-[#8458B3] to-[#a0d2eb] hover:from-[#a0d2eb] hover:to-[#8458B3] rounded-lg transition-all hover:scale-105 shadow-lg" style={{boxShadow: '0 4px 12px rgba(132, 88, 179, 0.3)'}}><Icon name="plus" className="w-5 h-5 text-white" /></button>
                  </div>
                ))
              ) : query.length >= 2 && <p className="text-gray-400 text-center py-4 text-sm">Ничего не найдено</p>}
            </div>
          </div>
        </div>
      )}

      <StatisticsPage 
        isOpen={showStatistics} 
        onClose={() => setShowStatistics(false)} 
        token={localStorage.getItem('token')}
        boards={boards}
        showMediaTab={true}
      />
      
      <MediaDetailsModal 
        item={selectedMedia} 
        onClose={() => setSelectedMedia(null)} 
        onUpdate={updateItem} 
        onReact={reactToItem} 
        isViewingFriend={!!viewingUser} 
        user={user}
        onTriggerAnimation={setAnimatingCard}
      />
      
      {/* Эпическая анимация 5 звезд */}
      {animatingCard && (
        <EpicFiveStarAnimation
          posterUrl={animatingCard.poster}
          cardId={animatingCard.id}
          onComplete={() => {
            setAnimatingCard(null);
            updateCardClass(animatingCard.id);
          }}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MovieApp />);

