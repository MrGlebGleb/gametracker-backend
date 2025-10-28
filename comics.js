const { useState, useEffect, useRef, Fragment, useCallback } = React;

// --- Глобальные константы и хелперы ---
// Обфусцированный API URL для базовой защиты
const getApiUrl = () => {
  const encoded = 'aHR0cHM6Ly9nYW1ldHJhY2tlci1iYWNrZW5kLXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHA=';
  return atob(encoded);
};
const API_URL = getApiUrl();
const REACTION_EMOJIS = ['😍', '🔥', '👍', '😮', '😂', '👎', '❤️', '🤔', '😢', '🤯'];
const COMICS_PER_COLUMN = 5;

// --- Comics Vine API интеграция через наш сервер ---
const ComicsVineAPI = {
  // Поиск комиксов по названию или автору через наш прокси
  async searchComics(query, limit = 10) {
    try {
      const response = await fetch(`${API_URL}/api/comics/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.comics || [];
    } catch (error) {
      console.error('Comics Vine search error:', error);
      return [];
    }
  }
};

// --- Переиспользуемые UI-компоненты ---

// Компонент иконок
const Icon = ({ name, className = 'w-6 h-6' }) => {
  const icons = {
    user: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    settings: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    users: <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    bell: <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    barChart: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    star: <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    search: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    x: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    check: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    userPlus: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    userCheck: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    userClock: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    loader: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  };
  return icons[name] || null;
};

const Avatar = ({ src, size = 'md', className = '' }) => {
  const sizes = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-20 h-20', xl: 'w-32 h-32' };
  return src ? (
    <img src={src} className={`${sizes[size]} avatar-circle ${className}`} alt="avatar" />
  ) : (
    <div className={`${sizes[size]} avatar-circle bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-bold ${className}`}>
      <Icon name="user" className={size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} />
    </div>
  );
};

// Компонент поиска комиксов
const ComicSearchModal = ({ isOpen, onClose, onAddComic, status = 'want_to_read' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedComic, setSelectedComic] = useState(null);

  const searchComics = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const comics = await ComicsVineAPI.searchComics(query);
      setResults(comics);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Автопоиск с debounce
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchComics();
    }, 300); // Задержка 300мс

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleAddComic = () => {
    if (selectedComic) {
      onAddComic(selectedComic, status);
      onClose();
      setSelectedComic(null);
      setQuery('');
      setResults([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a0f2e] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-[#8458B3]/30">
        <div className="p-6 border-b border-[#8458B3]/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Поиск комиксов</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Введите название комиксови или автора..."
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Поиск комиксов...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="grid gap-4">
              {results.map((comic) => (
                <div
                  key={comic.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedComic?.id === comic.id 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-gray-600 hover:border-gray-500 bg-gray-800'
                  }`}
                  onClick={() => setSelectedComic(comic)}
                >
                  <div className="flex gap-4">
                    <img
                      src={comic.coverUrl || 'https://placehold.co/64x80/1f2937/ffffff?text=📚'}
                      alt={comic.title}
                      className="w-16 h-20 object-cover rounded border"
                      onError={(e) => {
                        console.log('❌ Search modal image failed:', comic.coverUrl);
                        e.target.src = 'https://placehold.co/64x80/1f2937/ffffff?text=📚';
                        e.target.onerror = null;
                      }}
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-white line-clamp-2">{comic.title}</h3>
                      <p className="text-gray-300 text-sm">{comic.publisher}</p>
                      {comic.year && <p className="text-gray-400 text-sm">{comic.year}</p>}
                      {comic.issueCount && <p className="text-gray-400 text-sm">{comic.issueCount} выпусков</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query && !loading ? (
            <div className="text-center text-gray-500 py-8">
              Комиксы не найдены. Попробуйте другой запрос.
            </div>
          ) : null}
        </div>

        {selectedComic && (
          <div className="p-6 border-t border-gray-600 bg-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300">Выбран комикс:</p>
                <p className="font-semibold text-white">{selectedComic.title}</p>
                <p className="text-sm text-gray-300">{selectedComic.publisher}</p>
              </div>
              <button
                onClick={handleAddComic}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                Добавить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент уведомлений
const NotificationsPanel = ({ token, onNavigateToUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  // Загрузка уведомлений
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
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
    }
  }, [token]);

  // Загрузка количества непрочитанных
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
      console.error('Ошибка загрузки количества уведомлений:', error);
    }
  }, [token]);

  // Отметить как прочитанное
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
        className="p-2 hover:bg-violet-500/10 rounded-lg border border-violet-500/20 relative transition-all duration-200 hover:border-violet-500/40"
        title="Уведомления"
      >
        <Icon name="bell" className="w-4 h-4 md:w-5 md:h-5 text-violet-400 hover:text-violet-300 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full bg-red-500 ring-1 ring-white animate-pulse"></span>
        )}
      </button>

      {/* Выпадающее меню */}
      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-700/95 backdrop-blur-xl rounded-lg border border-violet-500/30 z-50 elevation-4 shadow-2xl">
          <div className="p-4 border-b border-violet-500/20">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white" style={{textShadow: '0 1px 2px rgba(139, 92, 246, 0.3)'}}>Уведомления</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Отметить все как прочитанные
                  </button>
                )}
              <button
                onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-violet-400 transition-colors"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-violet-500/10 cursor-pointer hover:bg-violet-500/5 transition-all duration-200 ${
                    !notification.is_read ? 'bg-violet-500/10 border-l-4 border-l-violet-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      !notification.is_read ? 'bg-violet-400 animate-pulse' : 'bg-gray-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{notification.message}</p>
                      <p className="text-violet-400/70 text-xs mt-1">{formatTime(notification.created_at)}</p>
                        </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2 opacity-50">🔔</div>
                <p className="text-violet-400/60 text-sm">Нет уведомлений</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент активности друзей для комиксов
function ComicActivityFeed({ token, onNavigateToUser }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
    if (!token) return;
    setLoading(true);
    try {
        const response = await fetch(`${API_URL}/api/friends/activity?type=comic`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Фильтруем только активность по комиксам
        const comicActivities = (data.activities || []).filter(act => 
          act.action_type && act.action_type.includes('comic')
        );
        setActivities(comicActivities);
        }
      } catch (err) {
        console.error("Failed to fetch comic activities", err);
    } finally {
      setLoading(false);
    }
    };
    fetchActivities();
    const interval = setInterval(fetchActivities, 60000);
    return () => clearInterval(interval);
  }, [token]);
  
  const boardTitles = { 
    want_to_read: 'Хочу прочитать', 
    reading: 'Читаю',
    read: 'Прочитал',
    dropped: 'Бросил'
  };

  const formatActivity = (act) => {
    const { username, action_type, details, user_id } = act;
    const bookName = <span className="font-bold text-green-300">{details.title}</span>;
    const clickableUsername = (
            <button
        onClick={() => onNavigateToUser && onNavigateToUser(user_id)}
        className="text-blue-400 hover:text-blue-300 underline cursor-pointer font-semibold"
            >
        {username}
            </button>
    );
    
    switch (action_type) {
      case 'add_comic':
        return <>{clickableUsername} добавил комикс {bookName} в <span className="italic">{boardTitles[details.status]}</span></>;
      case 'move_comic':
        return <>{clickableUsername} переместил комикс {bookName} в <span className="italic">{boardTitles[details.status]}</span></>;
      case 'rate_comic':
        return <>{clickableUsername} оценил комикс {bookName} на {details.rating}⭐</>;
      case 'remove_comic':
        return <>{clickableUsername} удалил комикс {bookName}</>;
      default:
        return <>{clickableUsername} выполнил действие с комиксовой {bookName}</>;
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#2d1b69]/60 to-[#1a0f2e]/50 backdrop-blur-xl rounded-xl border border-[#8B5CF6]/40 p-6">
      <h3 className="text-xl font-bold text-white mb-4">Активность друзей</h3>
      {loading ? (
        <div className="w-full flex items-center justify-center p-10">
          <Icon name="loader" className="w-8 h-8 text-violet-400 animate-spin"/>
        </div>
      ) : activities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map(act => (
            <div key={act.id} className="text-sm text-gray-300 p-4 bg-[#2d1b69]/60 rounded-lg border border-[#8B5CF6]/30 hover:border-[#A855F7] hover:-translate-y-1 transition-all">
              <p>{formatActivity(act)}</p>
              <div className="text-xs text-gray-500 mt-2 text-right">{new Date(act.created_at).toLocaleString('ru-RU')}</div>
        </div>
          ))}
                  </div>
            ) : (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-400 text-center">Пока нет активности от ваших друзей</p>
          </div>
      )}
    </div>
  );
}

// Компонент модального окна для деталей комиксови
function ComicDetailsModal({ comic, onClose, onUpdate, onReact, user }) {
  if (!comic) return null;
  const userReaction = (comic.reactions || []).find(r => r.user_id === user?.id);
  
  // Локальное состояние для мгновенного обновления рейтинга
  const [localRating, setLocalRating] = useState(comic.user_rating || 0);
  
  // Состояние для системы комментариев
  const [reviewText, setReviewText] = useState(comic.review || '');
  const [isPublished, setIsPublished] = useState(comic.is_published || false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Синхронизируем состояние с обновленным комиксом
  useEffect(() => {
    setReviewText(comic.review || '');
    setIsPublished(comic.is_published || false);
  }, [comic.review, comic.is_published]);

  // Синхронизируем локальное состояние с обновленной комиксовой
  useEffect(() => {
    setLocalRating(comic.user_rating || 0);
  }, [comic.user_rating]);

  const handleRatingClick = (rating) => {
    // Мгновенно обновляем локальное состояние
    setLocalRating(rating);
    // Вызываем onUpdate с правильным полем user_rating
    onUpdate(comic, { user_rating: rating });
  };

  // Обработка изменения текста рецензии
  const handleReviewChange = useCallback((text) => {
    if (text.length <= 1000) {
      setReviewText(text);
      
      // Сохраняем черновик только если текст изменился и не пустой
      if (text !== (comic.review || '') && text.length > 0) {
        // Очищаем предыдущий таймер
        if (handleReviewChange.timeoutId) {
          clearTimeout(handleReviewChange.timeoutId);
        }
        
        // Устанавливаем новый таймер
        handleReviewChange.timeoutId = setTimeout(() => {
          onUpdate(comic, { 
            review: text, 
            is_published: false 
          });
          setIsPublished(false);
        }, 1000); // Задержка 1 секунда
      }
    }
  }, [comic.review, comic, onUpdate]);

  // Публикация рецензии
  const publishReview = useCallback(() => {
    const updateData = { 
      review: reviewText, 
      is_published: true
    };
    console.log('Publishing comic review with data:', updateData);
    onUpdate(comic, updateData);
    setIsPublished(true);
  }, [reviewText, comic, onUpdate]);

  // Показать подтверждение удаления
  const showDeleteConfirmation = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  // Удаление отзыва
  const deleteReview = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/comics/${comic.id}/review`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Обновляем локальное состояние
        setReviewText('');
        setIsPublished(false);
        onUpdate(comic, { review: null, is_published: false });
        setShowDeleteConfirm(false);
        alert('Отзыв успешно удален');
      } else {
        throw new Error('Failed to delete review');
      }
    } catch (error) {
      console.error('Ошибка удаления отзыва:', error);
      alert('Не удалось удалить отзыв. Попробуйте еще раз.');
    }
  }, [comic.id, comic, onUpdate]);

  // Отмена удаления
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-[#2d1b69]/95 backdrop-blur-xl border border-[#8B5CF6]/50 modal-bg rounded-2xl p-6 w-full max-w-md border border-violet-500/30 max-h-[90vh] overflow-y-auto elevation-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{comic.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg"><Icon name="x" className="w-5 h-5 text-gray-400" /></button>
    </div>
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-2">Рейтинг:</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
      <button
                  key={star}
                  onClick={() => handleRatingClick(star)}
                  className={`w-6 h-6 transition-all duration-200 hover:scale-110 ${
                    star <= localRating
                      ? 'text-yellow-400 hover:text-yellow-300'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                  style={star <= localRating ? {filter: 'drop-shadow(0 0 6px rgba(255, 193, 7, 0.6))'} : {}}
                >
                  <Icon name="star" className="w-full h-full" />
      </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Текущий рейтинг: {localRating} из 5
            </p>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Отзыв:</label>
            <textarea 
              value={reviewText} 
              onChange={(e) => handleReviewChange(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white mt-1" 
              rows="4" 
              placeholder="Ваши впечатления..."
              maxLength="1000"
            />
            {/* Счетчик символов */}
            <div className="flex justify-between items-center mt-1">
              <div className="text-xs text-gray-500">
                {reviewText.length}/1000 символов
              </div>
              {reviewText.length > 800 && (
                <div className="text-xs text-yellow-400">
                  Осталось {1000 - reviewText.length} символов
                </div>
              )}
            </div>
            
            {/* Кнопки управления отзывом */}
            {reviewText.length > 0 && (
              <div className="flex justify-between items-center mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={publishReview}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 text-purple-300 hover:text-white rounded-lg transition-all duration-200 font-medium text-sm border border-purple-500/30 hover:border-purple-400/50"
                  >
                    {isPublished ? 'Изменить' : 'Опубликовать'}
                  </button>
                  <button
                    onClick={showDeleteConfirmation}
                    className="px-4 py-2 bg-gradient-to-r from-red-600/20 to-pink-600/20 hover:from-red-600/30 hover:to-pink-600/30 text-red-300 hover:text-white rounded-lg transition-all duration-200 font-medium text-sm border border-red-500/30 hover:border-red-400/50"
                  >
                    🗑️ Удалить
                  </button>
                </div>
              </div>
            )}
            
            {/* Статус публикации */}
            {reviewText && reviewText.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  📝 Отзыв
                </span>
              </div>
            )}
          </div>

          <div>
            <p className="text-gray-400 text-sm mb-2">Ваша реакция:</p>
            <div className="flex flex-wrap gap-2">
              {REACTION_EMOJIS.map(emoji => (
            <button
                  key={emoji} 
                  data-reaction-emoji={emoji}
                  onClick={() => onReact(comic, emoji)} 
                  className={`text-2xl reaction-button p-1 rounded-full ${userReaction?.emoji === emoji ? 'bg-purple-500/30' : 'hover:bg-gray-700/50'}`}
                >
                  {emoji}
            </button>
              ))}
            </div>
          </div>
          {comic.reactions && comic.reactions.length > 0 && (
            <div>
              <p className="text-gray-400 text-sm mb-2">Все реакции:</p>
              <div className="flex flex-wrap gap-2">
                {comic.reactions.map((reaction, index) => (
                  <span key={index} className="text-sm text-gray-300">
                    {reaction.emoji} {reaction.username}
                  </span>
                ))}
          </div>
        </div>
      )}
      
      {/* Модальное окно подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200]">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-red-500/30 mx-4">
            <div className="text-center">
              <div className="text-red-400 text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Удалить отзыв?</h3>
              <p className="text-gray-300 mb-6">
                Вы уверены, что хотите удалить свой отзыв? Это действие нельзя отменить.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-6 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-lg transition-all duration-200 font-medium border border-gray-600/30 hover:border-gray-500/50"
                >
                  Отмена
                </button>
                <button
                  onClick={deleteReview}
                  className="px-6 py-2 bg-gradient-to-r from-red-600/80 to-pink-600/80 hover:from-red-600 hover:to-pink-600 text-white rounded-lg transition-all duration-200 font-medium border border-red-500/50 hover:border-red-400/70"
                >
                  🗑️ Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}

// Компонент карточки комиксови (скопирован с MediaCard из movies.js)
function ComicCard({ comic, onEdit, onDelete, onRate, onReact, onMove, onSelect }) {
  // Определяем цвет полоски в зависимости от статуса
  const getAccentColor = (status) => {
    switch (status) {
      case 'want_to_read':
        return '#8B5CF6'; // Фиолетовый
      case 'reading':
        return '#F59E0B'; // Оранжевый
      case 'read':
        return '#6366F1'; // Индиго
      case 'dropped':
        return '#64748B'; // Серый
      default:
        return '#8B5CF6';
    }
  };
  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify(comic));
      }}
      onClick={() => {
        // Открываем модальное окно для редактирования/оценки
        onSelect(comic);
      }}
      data-card-id={comic.id}
      className="bg-[#2d1b69]/70 rounded-xl border-2 border-[#8B5CF6]/40 hover:border-[#A855F7] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer flex gap-3 p-2 group relative elevation-1 hover:elevation-2 shadow-transition media-card backdrop-blur-xl"
    >
      {/* Цветная полоска слева */}
      <div 
        className="w-1 rounded-l-xl flex-shrink-0" 
        style={{ backgroundColor: getAccentColor(comic.status), opacity: 0.8, boxShadow: '0 0 10px currentColor' }}
      ></div>
      <div className="relative flex-shrink-0">
        <img 
          src={comic.coverUrl || 'https://placehold.co/96x128/1f2937/ffffff?text=📚'} 
          alt={comic.title} 
          className="w-16 h-24 object-cover rounded-lg flex-shrink-0" 
          onError={(e) => {
            console.log('❌ Image failed to load:', {
              coverUrl: comic.coverUrl,
              title: comic.title,
              error: e.target.error,
              currentSrc: e.target.currentSrc,
              attemptedSrc: e.target.src
            });
            e.target.src = 'https://placehold.co/96x128/1f2937/ffffff?text=📚';
            e.target.onerror = null; // Предотвращаем бесконечный цикл
          }}
          onLoad={(e) => {
            console.log('✅ Image loaded successfully:', {
              coverUrl: comic.coverUrl,
              title: comic.title,
              currentSrc: e.target.src,
              naturalWidth: e.target.naturalWidth,
              naturalHeight: e.target.naturalHeight
            });
          }}
        />
      </div>
      <div className="flex flex-col justify-between flex-grow min-w-0 py-1">
        <div>
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1" style={{fontWeight: '600'}}>{comic.title}</h3>
          {comic.year && <p className="text-xs" style={{color: 'rgba(208, 189, 244, 0.8)'}}>{comic.year}</p>}
          <p className="text-xs text-gray-400 mb-1">{comic.publisher}</p>
          {/* Рейтинг под названием */}
          {comic.user_rating && comic.user_rating > 0 && (
            <div className="flex gap-0.5 mt-1">
              {[...Array(5)].map((_, i) => (
                <Icon 
                  key={i} 
                  name="star" 
                  className={`w-3 h-3 ${i < comic.user_rating ? 'text-yellow-400' : 'text-gray-500'}`} 
                  style={i < comic.user_rating ? {filter: 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.5))'} : {}} 
                />
              ))}
            </div>
          )}
          
          {/* Статус отзыва */}
          {comic.review && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                📝 Отзыв
              </span>
              {comic.review.length > 200 && (
                <span className="text-xs text-gray-400">
                  ({comic.review.length} симв.)
                </span>
              )}
            </div>
          )}
        </div>
        {comic.reactions && comic.reactions.length > 0 && (
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            {(() => {
              // Группируем реакции по emoji
              const groupedReactions = {};
              comic.reactions.forEach(r => {
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
              comic.reactions.forEach(r => {
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
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(comic.id);
        }} 
        className="absolute top-1 right-1 p-1.5 bg-red-600/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity self-start flex-shrink-0 z-10"
      >
        <Icon name="x" className="w-3 h-3 text-white" />
            </button>
    </div>
  );
}

// Компонент колонки
const ComicColumn = ({ title, status, comics, onDrop, onEdit, onDelete, onRate, onReact, onMove, onAddComic, onSelect, isExpanded, onToggleExpansion }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const bookData = JSON.parse(e.dataTransfer.getData('text/plain'));
      onDrop(bookData);
    } catch (error) {
      console.error('Drop error:', error);
    }
  };

  // Определяем цвета для разных статусов (приглушенная фиолетово-оранжевая палитра)
  const getColumnColors = (status) => {
    switch (status) {
      case 'want_to_read':
        return {
          bg: 'bg-gradient-to-b from-violet-500/15 to-purple-500/15',
          border: 'border-2 border-violet-500/40',
          text: 'text-violet-200',
          button: 'bg-violet-500/80 hover:bg-violet-600/80'
        };
      case 'reading':
        return {
          bg: 'bg-gradient-to-b from-purple-500/15 to-orange-500/15',
          border: 'border-2 border-purple-500/40',
          text: 'text-purple-200',
          button: 'bg-purple-500/80 hover:bg-purple-600/80'
        };
      case 'read':
        return {
          bg: 'bg-gradient-to-b from-indigo-500/15 to-violet-500/15',
          border: 'border-2 border-indigo-500/40',
          text: 'text-indigo-200',
          button: 'bg-indigo-500/80 hover:bg-indigo-600/80'
        };
      case 'dropped':
        return {
          bg: 'bg-gradient-to-b from-slate-500/15 to-gray-500/15',
          border: 'border-2 border-slate-500/40',
          text: 'text-slate-200',
          button: 'bg-slate-500/80 hover:bg-slate-600/80'
        };
      default:
        return {
          bg: 'bg-gradient-to-b from-gray-500/20 to-gray-600/20',
          border: 'border-2 border-gray-500/40',
          text: 'text-gray-300',
          button: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  const colors = getColumnColors(status);
  
  return (
    <div 
      className={`board-column ${colors.bg} ${colors.border} border rounded-xl p-5 min-h-96 backdrop-blur-xl ${
        isDragOver ? 'drag-over-column' : ''
      }`} 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold ${colors.text}`}>{title}</h2>
                    <button 
          onClick={onAddComic}
          className={`${colors.button} text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors hover:scale-105 active:scale-95`}
          title="Добавить комикс"
        >
          +
                    </button>
            </div>
      <div className="space-y-4">
        {(isExpanded ? comics : comics.slice(0, 5)).map((comic) => (
          <ComicCard
            key={comic.id}
            comic={comic}
            onEdit={onEdit}
            onDelete={onDelete}
            onRate={onRate}
            onReact={onReact}
            onMove={onMove}
            onSelect={onSelect}
          />
        ))}
        {comics.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-sm">Перетащите комикс сюда</p>
        </div>
        )}
        {comics.length > 5 && (
          <button
            onClick={() => onToggleExpansion(status)}
            className={`w-full ${colors.button} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:scale-105 active:scale-95 mt-4`}
          >
            {isExpanded ? 'Скрыть' : `Показать ещё (${comics.length - 5})`}
          </button>
        )}
      </div>
    </div>
  );
};

// Главный компонент приложения
const ComicsTrackerApp = () => {
  const [comics, setComics] = useState([]);
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingComic, setEditingComic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('default');
  const [showStatistics, setShowStatistics] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserHub, setShowUserHub] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [myBooksSearchQuery, setMyBooksSearchQuery] = useState('');
  const [expandedColumns, setExpandedColumns] = useState({
    want_to_read: false,
    reading: false,
    read: false,
    dropped: false
  });
  const [myBooksSearchResults, setMyBooksSearchResults] = useState([]);
  const [myBooksSearching, setMyBooksSearching] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('want_to_read');
  const [selectedComic, setSelectedComic] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [profileData, setProfileData] = useState({ username: '', bio: '', currentPassword: '', newPassword: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  

  // Загрузка данных при монтировании
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    // Загружаем пользователя из localStorage как в movies.js
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setTheme(parsedUser.theme || 'default');
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/';
        return;
      }
        } else {
      // Если пользователь не найден в localStorage, перенаправляем на главную
      window.location.href = '/';
      return;
    }

    loadComics();
    loadFriends();
  }, []);

  // Применяем тему при изменении
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const loadComics = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found, skipping comics load');
      setLoading(false);
      return;
    }

    console.log('Loading comics with token:', token.substring(0, 10) + '...');
    
    try {
      const response = await fetch(`${API_URL}/api/comics`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
      
      console.log('Comics API response status:', response.status);
      
                if (response.ok) {
        const comicsData = await response.json();
        console.log('Loaded comics:', comicsData.length);
        console.log('Comics data:', comicsData);
        
        // Преобразуем данные из базы в формат для компонентов
        const normalizedComics = comicsData.map(comic => ({
          ...comic,
          coverUrl: comic.cover_url, // Преобразуем cover_url в coverUrl
          user_rating: comic.user_rating || null, // Используем null вместо 0
          reactions: comic.reactions || []
        }));
        
        normalizedComics.forEach((comic, index) => {
          console.log(`Comic ${index + 1}:`, {
            title: comic.title,
            coverUrl: comic.coverUrl,
            publisher: comic.publisher
          });
        });
        setComics(normalizedComics);
      } else if (response.status === 401) {
        console.log('Token invalid, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      } else {
        console.error('Comics API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error loading comics:', error);
            } finally {
                setLoading(false);
            }
        };

  const loadFriends = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const friendsData = await response.json();
        setFriends(friendsData.friends || []);
        setFriendRequests(friendsData.requests || []);
      } else if (response.status === 401) {
        // Токен недействителен
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadUserBooks = async (userId = null) => {
  const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const url = userId ? `${API_URL}/api/user/${userId}/books` : `${API_URL}/api/comics`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const booksData = await response.json();
      if (userId) {
          // Загружаем комиксови друга
          // Сначала загружаем данные пользователя
          const userResponse = await fetch(`${API_URL}/api/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setViewingUser({ id: userId, username: userData.username || userData.nickname || 'Друг' });
      } else {
            setViewingUser({ id: userId, username: 'Друг' });
      }
          setComics(comicsData);
      } else {
          // Загружаем свои комиксови
          setViewingUser(null);
          setComics(comicsData);
        }
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }
    } catch (error) {
      console.error('Error loading user comics:', error);
    }
  };


  const searchMyBooks = async (query) => {
    if (!query.trim()) {
      setMyBooksSearchResults([]);
      return;
    }

    setMyBooksSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/comics/search-my?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
          const data = await response.json();
        setMyBooksSearchResults(data.books || []);
      }
    } catch (error) {
      console.error('Error searching my comics:', error);
    } finally {
      setMyBooksSearching(false);
    }
  };

  const addComic = async (comicData, status = 'want_to_read') => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for adding comic');
      return;
    }

    console.log('Adding comic:', comicData, 'with status:', status);
    console.log('Comic coverUrl:', comicData.coverUrl);
    
    try {
      const response = await fetch(`${API_URL}/api/comics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...comicData,
          status: status
        })
      });

      console.log('Add comic response status:', response.status);
      
      if (response.ok) {
        const newComic = await response.json();
        console.log('Comic added successfully:', newComic);
        
        // Нормализуем данные нового комикса
        const normalizedNewComic = {
          ...newComic,
          coverUrl: newComic.cover_url,
          user_rating: newComic.user_rating || null, // Используем null вместо 0
          reactions: newComic.reactions || []
        };
        
        // Принудительно обновляем состояние
        setComics(prev => {
          const updatedComics = [...prev, normalizedNewComic];
          console.log('Updated comics state:', updatedComics);
          return updatedComics;
        });
        
        showToast('Комикс добавлен!', 'success');
      } else {
        const errorText = await response.text();
        console.error('Add comic error:', response.status, errorText);
        showToast('Ошибка при добавлении комиксови', 'error');
      }
    } catch (error) {
      console.error('Error adding comic:', error);
      showToast('Ошибка при добавлении комиксови', 'error');
    }
  };

  const updateComicStatus = async (comicId, newStatus) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/comics/${comicId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setComics(prev => prev.map(comic => 
          comic.id === comicId ? { ...comic, status: newStatus } : comic
        ));
      }
    } catch (error) {
      console.error('Error updating comic status:', error);
      showToast('Ошибка при обновлении статуса', 'error');
    }
  };

  const deleteComic = async (comicId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/comics/${comicId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setComics(prev => prev.filter(comic => comic.id !== comicId));
        showToast('Комикс удален', 'info');
    } else {
        console.error('Delete comic error:', response.status, response.statusText);
        showToast('Ошибка при удалении комиксови', 'error');
      }
    } catch (error) {
      console.error('Error deleting comic:', error);
      showToast('Ошибка при удалении комиксови', 'error');
    }
  };

  const rateComic = async (comicId, rating) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/comics/${comicId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating })
      });

      if (response.ok) {
        setComics(prev => prev.map(comic => 
          comic.id === comicId ? { ...comic, rating } : comic
        ));
        showToast('Рейтинг сохранен!', 'success');
      }
    } catch (error) {
      console.error('Error rating comic:', error);
      showToast('Ошибка при сохранении рейтинга', 'error');
    }
  };

  const reactToComic = async (comicId, emoji) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/comics/${comicId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });

      if (response.ok) {
        showToast('Реакция добавлена!', 'success');
      }
    } catch (error) {
      console.error('Error reacting to comic:', error);
      showToast('Ошибка при добавлении реакции', 'error');
    }
  };

  const updateComic = async (comic, updates) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Если обновляется рейтинг, используем специальный endpoint
      if (updates.user_rating !== undefined) {
        const response = await fetch(`${API_URL}/api/comics/${comic.id}/rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rating: updates.user_rating })
        });

        if (response.ok) {
          const updatedComic = await response.json();
          const normalizedUpdatedComic = {
            ...updatedComic,
            coverUrl: updatedComic.cover_url,
            user_rating: updatedComic.user_rating || null, // Используем null вместо 0
            reactions: updatedComic.reactions || []
          };
          setComics(prev => prev.map(c => c.id === comic.id ? normalizedUpdatedComic : c));
          showToast('Рейтинг сохранен!', 'success');
    } else {
          showToast('Ошибка при сохранении рейтинга', 'error');
        }
        return;
      }

      // Для других обновлений используем обычный PATCH
      const response = await fetch(`${API_URL}/api/comics/${comic.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedComic = await response.json();
        const normalizedUpdatedComic = {
          ...updatedComic,
          coverUrl: updatedComic.cover_url,
          user_rating: updatedComic.user_rating || null, // Используем null вместо 0
          reactions: updatedComic.reactions || []
        };
        setComics(prev => prev.map(c => c.id === comic.id ? normalizedUpdatedComic : c));
        
        // Показываем уведомление только для важных обновлений, не для отзывов и статуса
        const isReviewUpdate = updates.hasOwnProperty('review') || updates.hasOwnProperty('is_published');
        const isStatusUpdate = updates.hasOwnProperty('status');
        
        if (!isReviewUpdate && !isStatusUpdate) {
          showToast('Комикс обновлен!', 'success');
        }
      }
    } catch (error) {
      console.error('Error updating comic:', error);
      showToast('Ошибка при обновлении комиксови', 'error');
    }
  };

  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  const toggleTheme = () => {
    const newTheme = theme === 'default' ? 'liquid-eye' : 'default';
    setTheme(newTheme);
    
    // Обновляем пользователя в localStorage с новой темой
    if (user) {
      const updatedUser = { ...user, theme: newTheme };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Функции для кнопок в шапке
  const handleStatistics = () => {
    setShowStatistics(true);
  };

  const handleProfile = () => {
    setShowProfile(true);
  };

  const handleUserHub = () => {
    setShowUserHub(true);
  };

  // Обработка загрузки аватара
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

        setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_URL}/api/user/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...user, avatar: data.avatar };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        showToast('Аватар обновлен!', 'success');
      } else {
        showToast('Ошибка загрузки аватара', 'error');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast('Ошибка загрузки аватара', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Обновление профиля
  const updateProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...user, ...data };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setProfileData({ username: '', bio: '', currentPassword: '', newPassword: '' });
        showToast('Профиль обновлен!', 'success');
        setShowProfile(false);
      } else {
        showToast('Ошибка обновления профиля', 'error');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Ошибка обновления профиля', 'error');
    }
  };

  // Загрузка всех пользователей
  const loadAllUsers = async (query = '') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Действия с друзьями
  const friendAction = async (userId, action) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/friends/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (response.ok) {
        showToast('Действие выполнено!', 'success');
        loadFriends();
        loadAllUsers(userSearchQuery);
      } else {
        showToast('Ошибка выполнения действия', 'error');
      }
    } catch (error) {
      console.error('Error with friend action:', error);
      showToast('Ошибка выполнения действия', 'error');
    }
  };

  // Переключение состояния столбцов
  const toggleColumnExpansion = (status) => {
    setExpandedColumns(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  // Группировка комиксов по статусам
  const comicsByStatus = {
    want_to_read: comics.filter(comic => comic.status === 'want_to_read'),
    reading: comics.filter(comic => comic.status === 'reading'),
    read: comics.filter(comic => comic.status === 'read'),
    dropped: comics.filter(comic => comic.status === 'dropped')
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1625] to-[#2d1b4e]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1625] to-[#2d1b4e]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-white">Перенаправление...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#1a0f2e] to-[#2d1b69] ${theme} flex flex-col`}>
      <header className="bg-[#1a0f2e]/95 backdrop-blur-xl border-b border-[#8B5CF6]/30 sticky top-0 z-50 flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Кнопки навигации */}
              <div className="flex gap-6">
                <a
                  href="/index.html"
                  className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 hover:scale-105 transition-transform cursor-pointer"
                >
                  🎮 Game
                </a>
                <a
                  href="/movies.html"
                  className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 hover:scale-105 transition-transform cursor-pointer"
                >
                  🎬 Movie
                </a>
                <a
                  href="/books.html"
                  className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 hover:scale-105 transition-transform cursor-pointer"
                >
                  📚 Book
                </a>
                <span className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-pink-400">
                  📚 Comic
                </span>
              </div>
            </div>
            {user && (
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-[#10b981]/25 to-[#3b82f6]/20 rounded-lg border border-[#3b82f6]/40">
                        <Avatar src={user.avatar} size="sm" />
                        <span className="text-white font-semibold text-sm md:text-base block">{user.username}</span>
                    </div>
                       <Fragment>
                        <button onClick={handleStatistics} className="p-2 hover:bg-gray-800 rounded-lg border border-violet-500/30" title="Статистика комиксов">
                            <Icon name="barChart" className="w-4 h-4 md:w-5 md:h-5 text-violet-400 hover:text-violet-300 hover:scale-110 transition-all header-icon" />
                         </button>
                        <button onClick={handleProfile} className="p-2 hover:bg-gray-800 rounded-lg border border-violet-500/30">
                            <Icon name="settings" className="w-4 h-4 md:w-5 md:h-5 text-violet-400 hover:text-violet-300 hover:scale-110 transition-all header-icon" />
                           </button>
                        <button onClick={handleUserHub} className="p-2 hover:bg-gray-800 rounded-lg border border-violet-500/30 relative">
                            <Icon name="users" className="w-4 h-4 md:w-5 md:h-5 text-violet-400 hover:text-violet-300 hover:scale-110 transition-all header-icon" />
                               {friendRequests.length > 0 && <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white badge-notification"></span>}
                           </button>
                       </Fragment>
                    <NotificationsPanel 
                      token={localStorage.getItem('token')} 
                      onNavigateToUser={(userId) => {
                        console.log('Navigating to user from notification:', userId);
                        loadUserBooks(userId);
                      }}
                    />
                </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-6 space-y-8">
        {/* Кнопка "Назад" при просмотре доски друга */}
        {viewingUser && (
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => loadUserBooks(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад к моим комиксам
            </button>
            <h2 className="text-xl font-semibold text-white">
              Комиксы {viewingUser.username || 'друга'}
            </h2>
          </div>
        )}

        {/* Доска комиксов */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ComicColumn
            title="📖 Хочу прочитать"
            status="want_to_read"
            comics={comicsByStatus.want_to_read}
            onDrop={(comic) => updateComicStatus(comic.id, 'want_to_read')}
            onEdit={(comic) => {
              setEditingComic(comic);
              setShowEditModal(true);
            }}
            onDelete={deleteComic}
            onRate={rateComic}
            onReact={reactToComic}
            onMove={updateComicStatus}
            onAddComic={() => {
              setSelectedStatus('want_to_read');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedComic}
            isExpanded={expandedColumns.want_to_read}
            onToggleExpansion={toggleColumnExpansion}
          />
          
          <ComicColumn
            title="📚 Читаю"
            status="reading"
            comics={comicsByStatus.reading}
            onDrop={(comic) => updateComicStatus(comic.id, 'reading')}
            onEdit={(comic) => {
              setEditingComic(comic);
              setShowEditModal(true);
            }}
            onDelete={deleteComic}
            onRate={rateComic}
            onReact={reactToComic}
            onMove={updateComicStatus}
            onAddComic={() => {
              setSelectedStatus('reading');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedComic}
            isExpanded={expandedColumns.reading}
            onToggleExpansion={toggleColumnExpansion}
          />
          
          <ComicColumn
            title="✅ Прочитал"
            status="read"
            comics={comicsByStatus.read}
            onDrop={(comic) => updateComicStatus(comic.id, 'read')}
            onEdit={(comic) => {
              setEditingComic(comic);
              setShowEditModal(true);
            }}
            onDelete={deleteComic}
            onRate={rateComic}
            onReact={reactToComic}
            onMove={updateComicStatus}
            onAddComic={() => {
              setSelectedStatus('read');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedComic}
            isExpanded={expandedColumns.read}
            onToggleExpansion={toggleColumnExpansion}
          />
          
          <ComicColumn
            title="❌ Бросил"
            status="dropped"
            comics={comicsByStatus.dropped}
            onDrop={(comic) => updateComicStatus(comic.id, 'dropped')}
            onEdit={(comic) => {
              setEditingComic(comic);
              setShowEditModal(true);
            }}
            onDelete={deleteComic}
            onRate={rateComic}
            onReact={reactToComic}
            onMove={updateComicStatus}
            onAddComic={() => {
              setSelectedStatus('dropped');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedComic}
            isExpanded={expandedColumns.dropped}
            onToggleExpansion={toggleColumnExpansion}
          />
            </div>

        {/* Поиск по своим комиксовам */}
        <div className="w-full">
          <div className="bg-gray-800/25 backdrop-blur-sm rounded-lg p-4 border border-violet-500/15">
            <div className="flex gap-2">
              <input
                type="text"
                value={myBooksSearchQuery}
                onChange={(e) => {
                  setMyBooksSearchQuery(e.target.value);
                  searchMyBooks(e.target.value);
                }}
                placeholder="Найти в моих комиксовах..."
                className="flex-1 px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-lg text-white/80 placeholder-gray-500 focus:border-green-500/50 focus:outline-none"
              />
              {myBooksSearching && <Icon name="loader" className="w-6 h-6 text-violet-500 animate-spin" />}
            </div>
              
            {myBooksSearchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {myBooksSearchResults.map((comic) => (
                  <div key={comic.id} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                    <div className="flex gap-3">
                      <img
                        src={comic.coverUrl || 'https://placehold.co/48x64/1f2937/ffffff?text=📚'}
                        alt={comic.title}
                        className="w-12 h-16 object-cover rounded"
                        onError={(e) => {
                          console.log('❌ Activity feed image failed:', comic.coverUrl);
                          e.target.src = 'https://placehold.co/48x64/1f2937/ffffff?text=📚';
                          e.target.onerror = null;
                        }}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm line-clamp-2">{comic.title}</h3>
                        <p className="text-gray-400 text-xs">{comic.publisher}</p>
                        <span className="inline-block px-2 py-1 bg-green-600 text-white text-xs rounded mt-1">
                          {comic.status === 'want_to_read' && 'Хочу прочитать'}
                          {comic.status === 'reading' && 'Читаю'}
                          {comic.status === 'read' && 'Прочитал'}
                          {comic.status === 'dropped' && 'Бросил'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                      </div>
                    )}
                      </div>
        </div>

        {/* Активность друзей */}
        {!viewingUser && (
          <ComicActivityFeed 
            token={localStorage.getItem('token')} 
            onNavigateToUser={(userId) => {
              console.log('Navigating to user:', userId);
              loadUserBooks(userId);
            }}
          />
        )}
      </main>

      {/* Модальные окна */}
      <ComicSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddComic={addComic}
        status={selectedStatus}
      />
      
      <ComicDetailsModal
        comic={selectedComic}
        onClose={() => setSelectedComic(null)}
        onUpdate={updateComic}
        onReact={reactToComic}
        user={user}
      />

      {/* Модальное окно статистики */}
      {showStatistics && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowStatistics(false)}>
          <div className="bg-[#2d1b69]/95 backdrop-blur-xl border border-[#8B5CF6]/50 modal-bg rounded-2xl p-6 w-full max-w-2xl border border-violet-500/30 max-h-[90vh] overflow-y-auto elevation-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white" style={{textShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'}}>Статистика комиксов</h2>
              <button onClick={() => setShowStatistics(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                <Icon name="x" className="w-5 h-5 text-gray-400" />
              </button>
                  </div>
            <div className="space-y-6">
              {/* Основная статистика */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">Всего комиксов</h3>
                  <p className="text-3xl font-bold text-green-400">{comics.length}</p>
                  </div>
                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg p-4 border border-blue-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">Прочитано</h3>
                  <p className="text-3xl font-bold text-blue-400">{comics.filter(b => b.status === 'read').length}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-4 border border-yellow-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">Читаю</h3>
                  <p className="text-3xl font-bold text-yellow-400">{comics.filter(b => b.status === 'reading').length}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg p-4 border border-purple-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">Хочу прочитать</h3>
                  <p className="text-3xl font-bold text-purple-400">{comics.filter(b => b.status === 'want_to_read').length}</p>
                </div>
            </div>

              {/* Дополнительная статистика */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Брошено</h3>
                  <p className="text-3xl font-bold text-red-400">{comics.filter(b => b.status === 'dropped').length}</p>
              </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">С рейтингом</h3>
                  <p className="text-3xl font-bold text-yellow-400">{comics.filter(b => b.user_rating && b.user_rating > 0).length}</p>
          </div>
                </div>

              {/* Прогресс чтения */}
              {comics.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Прогресс чтения</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Прочитано</span>
                        <span>{Math.round((comics.filter(b => b.status === 'read').length / comics.length) * 100)}%</span>
            </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${(comics.filter(b => b.status === 'read').length / comics.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>В процессе</span>
                        <span>{Math.round((comics.filter(b => b.status === 'reading').length / comics.length) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${(comics.filter(b => b.status === 'reading').length / comics.length) * 100}%` }}
                        ></div>
                      </div>
                </div>
            </div>
          </div>
        )}
            </div>
          </div>
          </div>
        )}

      {/* Модальное окно настроек */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowProfile(false)}>
          <div className="bg-[#2d1b69]/95 backdrop-blur-xl border border-[#8B5CF6]/50 modal-bg rounded-2xl p-6 w-full max-w-md border border-violet-500/30 max-h-[90vh] overflow-y-auto elevation-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-4" style={{textShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'}}>Настройки профиля</h2>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar src={user?.avatar} size="xl" />
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50">
                  {uploadingAvatar ? <Icon name="loader" className="w-4 h-4" /> : <Icon name="upload" className="w-4 h-4" />} {uploadingAvatar ? 'Загрузка...' : 'Загрузить аватар'}
                </button>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Имя пользователя:</label>
                <input type="text" value={profileData.username} onChange={(e) => setProfileData({ ...profileData, username: e.target.value })} placeholder={user?.username} className="w-full px-4 py-2 bg-[#10b981]/15 border border-[#a8e6cf]/30 rounded-lg focus:border-[#a8e6cf] focus:outline-none focus:shadow-[0_0_0_3px_rgba(168,230,207,0.1)] text-white mt-1" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">О себе:</label>
                <textarea value={profileData.bio} onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })} placeholder={user?.bio || 'Расскажи о себе...'} className="w-full px-4 py-2 bg-[#10b981]/15 border border-[#a8e6cf]/30 rounded-lg focus:border-[#a8e6cf] focus:outline-none focus:shadow-[0_0_0_3px_rgba(168,230,207,0.1)] text-white mt-1" rows="3" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Тема оформления:</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setTheme('default')} className={`flex-1 py-2 rounded-lg text-sm ${theme === 'default' ? 'bg-green-500 text-white' : 'bg-gray-800'}`}>Стандартная</button>
                  <button onClick={() => setTheme('liquid-eye')} className={`flex-1 py-2 rounded-lg text-sm ${theme === 'liquid-eye' ? 'bg-white text-black' : 'bg-gray-800'}`}>Liquid Eye</button>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Текущий пароль (для изменения):</label>
                <input type="password" value={profileData.currentPassword} onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })} className="w-full px-4 py-2 bg-[#10b981]/15 border border-[#a8e6cf]/30 rounded-lg focus:border-[#a8e6cf] focus:outline-none focus:shadow-[0_0_0_3px_rgba(168,230,207,0.1)] text-white mt-1" />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Новый пароль:</label>
                <input type="password" value={profileData.newPassword} onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })} className="w-full px-4 py-2 bg-[#10b981]/15 border border-[#a8e6cf]/30 rounded-lg focus:border-[#a8e6cf] focus:outline-none focus:shadow-[0_0_0_3px_rgba(168,230,207,0.1)] text-white mt-1" />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <button onClick={handleLogout} className="w-full py-2 bg-red-600 border-2 border-[#a28089] hover:bg-red-700 text-white font-bold rounded-lg flex items-center justify-center gap-2">
                  <Icon name="logout" className="w-4 h-4" />
                  Выйти из аккаунта
                </button>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={updateProfile} className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-lg hover:from-violet-700 hover:to-purple-700">Сохранить</button>
                <button onClick={() => setShowProfile(false)} className="flex-1 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно друзей */}
      {showUserHub && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowUserHub(false)}>
          <div className="bg-[#2d1b69]/95 backdrop-blur-xl border border-[#8B5CF6]/50 modal-bg rounded-2xl p-6 w-full max-w-3xl border border-violet-500/30 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white" style={{textShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'}}>Сообщество</h2>
              <button onClick={() => setShowUserHub(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                <Icon name="x" className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="overflow-y-auto">
              {friendRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Запросы в друзья ({friendRequests.length})</h3>
                  <div className="space-y-3">
                    {friendRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <Avatar src={req.avatar} size="md" />
                        <div className="flex-1 cursor-pointer" onClick={() => { loadUserBooks(req.id); setShowUserHub(false); }}>
                          <p className="text-white font-semibold">{req.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => friendAction(req.id, 'accept')} className="p-2 bg-violet-500/20 hover:bg-violet-500/30 rounded-lg">
                            <Icon name="check" className="w-5 h-5 text-violet-400" />
                          </button>
                          <button onClick={() => friendAction(req.id, 'reject')} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg">
                            <Icon name="x" className="w-5 h-5 text-red-400" />
                          </button>
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
                        <div className="flex-1 cursor-pointer" onClick={() => { loadUserBooks(friend.id); setShowUserHub(false); }}>
                          <p className="text-white font-semibold">{friend.nickname || friend.username}</p>
                          {friend.nickname && <p className="text-xs text-gray-400">@{friend.username}</p>}
                        </div>
                        <button onClick={() => friendAction(friend.id, 'remove')} className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon name="x" className="w-5 h-5 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Все пользователи</h3>
                <input 
                  type="text" 
                  value={userSearchQuery} 
                  onChange={(e) => { 
                    setUserSearchQuery(e.target.value); 
                    loadAllUsers(e.target.value); 
                  }} 
                  placeholder="Поиск пользователей..." 
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none text-white mb-4" 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allUsers.map(u => {
                    const isFriend = friends.some(f => f.id === u.id);
                    const hasRequest = friendRequests.some(r => r.id === u.id);
                    const isMe = u.id === user?.id;
                    
                    if (isMe) return null;
                    
                    return (
                      <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                        <Avatar src={u.avatar} size="md" />
                        <div className="flex-1 cursor-pointer" onClick={() => { loadUserBooks(u.id); setShowUserHub(false); }}>
                          <p className="text-white font-semibold">{u.nickname || u.username}</p>
                          {u.nickname && <p className="text-xs text-gray-400">@{u.username}</p>}
                        </div>
                        {!isFriend && !hasRequest && (
                          <button 
                            onClick={() => friendAction(u.id, 'request')} 
                            className="px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm"
                          >
                            Добавить
                          </button>
                        )}
                        {hasRequest && (
                          <span className="text-gray-400 text-sm">Запрос отправлен</span>
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
    </div>
  );
};

// Рендер приложения
ReactDOM.render(<ComicsTrackerApp />, document.getElementById('root'));
