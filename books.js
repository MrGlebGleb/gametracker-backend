const { useState, useEffect, useRef, Fragment, useCallback } = React;

// --- Глобальные константы и хелперы ---
// Обфусцированный API URL для базовой защиты
const getApiUrl = () => {
  const encoded = 'aHR0cHM6Ly9nYW1ldHJhY2tlci1iYWNrZW5kLXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHA=';
  return atob(encoded);
};
const API_URL = getApiUrl();
const REACTION_EMOJIS = ['😍', '🔥', '👍', '😮', '😂', '👎', '❤️', '🤔', '😢', '🤯'];
const BOOKS_PER_COLUMN = 5;

// --- OpenLibrary API интеграция через наш сервер ---
const OpenLibraryAPI = {
  // Поиск книг по названию или автору через наш прокси
  async searchBooks(query, limit = 10) {
    try {
      const response = await fetch(`${API_URL}/api/books/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.books || [];
    } catch (error) {
      console.error('OpenLibrary search error:', error);
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
    users: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>,
    bell: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5L19 5M15 17h5l-5 5v-5z" /></svg>,
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

// Компонент поиска книг
const BookSearchModal = ({ isOpen, onClose, onAddBook }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const searchBooks = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const books = await OpenLibraryAPI.searchBooks(query);
      setResults(books);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = () => {
    if (selectedBook) {
      onAddBook(selectedBook);
      onClose();
      setSelectedBook(null);
      setQuery('');
      setResults([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Поиск книг</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchBooks()}
              placeholder="Введите название книги или автора..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={searchBooks}
              disabled={loading || !query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Поиск...' : 'Найти'}
            </button>
          </div>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="grid gap-4">
              {results.map((book) => (
                <div
                  key={book.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedBook?.id === book.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedBook(book)}
                >
                  <div className="flex gap-4">
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-16 h-20 object-cover rounded border"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80"><rect width="64" height="80" fill="%23f3f4f6"/><text x="32" y="45" text-anchor="middle" fill="%236b7280" font-size="12">📚</text></svg>';
                      }}
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-2">{book.title}</h3>
                      <p className="text-gray-600 text-sm">{book.author}</p>
                      {book.year && <p className="text-gray-500 text-sm">{book.year}</p>}
                      {book.pages && <p className="text-gray-500 text-sm">{book.pages} стр.</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query && !loading ? (
            <div className="text-center text-gray-500 py-8">
              Книги не найдены. Попробуйте другой запрос.
            </div>
          ) : null}
        </div>

        {selectedBook && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Выбрана книга:</p>
                <p className="font-semibold text-gray-900">{selectedBook.title}</p>
                <p className="text-sm text-gray-600">{selectedBook.author}</p>
              </div>
              <button
                onClick={handleAddBook}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
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

// Компонент карточки книги
const BookCard = ({ book, onEdit, onDelete, onRate, onReact, onMove }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', JSON.stringify(book));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`book-card bg-white rounded-lg shadow-md border-2 border-gray-200 hover:shadow-lg transition-all duration-300 cursor-move ${
        isDragging ? 'dragging-card' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-card-id={book.id}
    >
      <div className="relative">
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-full h-48 object-cover rounded-t-lg"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="192" viewBox="0 0 200 192"><rect width="200" height="192" fill="%23f3f4f6"/><text x="100" y="100" text-anchor="middle" fill="%236b7280" font-size="48">📚</text></svg>';
          }}
        />
        
        {/* Кнопки действий */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 bg-white/80 rounded-full hover:bg-white transition-colors"
            title="Подробнее"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(book)}
            className="p-1 bg-white/80 rounded-full hover:bg-white transition-colors"
            title="Редактировать"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(book.id)}
            className="p-1 bg-white/80 rounded-full hover:bg-red-100 transition-colors"
            title="Удалить"
          >
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">{book.title}</h3>
        <p className="text-sm text-gray-600 mb-2">{book.author}</p>
        
        {book.year && (
          <p className="text-xs text-gray-500 mb-2">{book.year}</p>
        )}

        {/* Рейтинг */}
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onRate(book.id, star)}
              className="text-yellow-400 hover:text-yellow-500 transition-colors"
            >
              <svg
                className={`w-4 h-4 ${star <= (book.rating || 0) ? 'fill-current' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          ))}
        </div>

        {/* Реакции */}
        <div className="flex items-center gap-1 mb-2">
          {REACTION_EMOJIS.slice(0, 5).map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(book.id, emoji)}
              className="text-lg hover:scale-110 transition-transform"
              title="Добавить реакцию"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Детали книги */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            {book.description && (
              <p className="text-xs text-gray-600 mb-2 line-clamp-3">{book.description}</p>
            )}
            {book.pages && (
              <p className="text-xs text-gray-500">{book.pages} страниц</p>
            )}
            {book.subjects && book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {book.subjects.slice(0, 3).map((subject, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-xs rounded-full"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент колонки
const BookColumn = ({ title, books, onDrop, onEdit, onDelete, onRate, onReact, onMove }) => {
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

  return (
    <div
      className={`board-column bg-gray-50 rounded-lg p-4 min-h-96 ${
        isDragOver ? 'drag-over-column' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">{title}</h2>
      <div className="space-y-4">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onEdit={onEdit}
            onDelete={onDelete}
            onRate={onRate}
            onReact={onReact}
            onMove={onMove}
          />
        ))}
        {books.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p>Перетащите книгу сюда</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Главный компонент приложения
const BookTrackerApp = () => {
  const [books, setBooks] = useState([]);
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('default');
  const [showStatistics, setShowStatistics] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserHub, setShowUserHub] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [myBooksSearchQuery, setMyBooksSearchQuery] = useState('');
  const [myBooksSearchResults, setMyBooksSearchResults] = useState([]);
  const [myBooksSearching, setMyBooksSearching] = useState(false);
  const [showMyBooksSearch, setShowMyBooksSearch] = useState(false);
  const [activities, setActivities] = useState([]);

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

    loadBooks();
    loadFriends();
    loadActivities();
  }, []);

  // Применяем тему при изменении
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const loadBooks = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/books`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const booksData = await response.json();
        setBooks(booksData);
      } else if (response.status === 401) {
        // Токен недействителен
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }
    } catch (error) {
      console.error('Error loading books:', error);
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

  const loadActivities = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/friends/activity?type=book`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      } else {
        // Если endpoint не существует, просто не показываем активность
        setActivities([]);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    }
  };

  const searchMyBooks = async (query) => {
    if (!query.trim()) {
      setMyBooksSearchResults([]);
      return;
    }

    setMyBooksSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/books/search-my?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMyBooksSearchResults(data.books || []);
      }
    } catch (error) {
      console.error('Error searching my books:', error);
    } finally {
      setMyBooksSearching(false);
    }
  };

  const addBook = async (bookData) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...bookData,
          status: 'want_to_read'
        })
      });

      if (response.ok) {
        const newBook = await response.json();
        setBooks(prev => [...prev, newBook]);
        showToast('Книга добавлена!', 'success');
      }
    } catch (error) {
      console.error('Error adding book:', error);
      showToast('Ошибка при добавлении книги', 'error');
    }
  };

  const updateBookStatus = async (bookId, newStatus) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setBooks(prev => prev.map(book => 
          book.id === bookId ? { ...book, status: newStatus } : book
        ));
        showToast('Статус книги обновлен!', 'success');
      }
    } catch (error) {
      console.error('Error updating book status:', error);
      showToast('Ошибка при обновлении статуса', 'error');
    }
  };

  const deleteBook = async (bookId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setBooks(prev => prev.filter(book => book.id !== bookId));
        showToast('Книга удалена', 'info');
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      showToast('Ошибка при удалении книги', 'error');
    }
  };

  const rateBook = async (bookId, rating) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/books/${bookId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating })
      });

      if (response.ok) {
        setBooks(prev => prev.map(book => 
          book.id === bookId ? { ...book, rating } : book
        ));
        showToast('Рейтинг сохранен!', 'success');
      }
    } catch (error) {
      console.error('Error rating book:', error);
      showToast('Ошибка при сохранении рейтинга', 'error');
    }
  };

  const reactToBook = async (bookId, emoji) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/books/${bookId}/react`, {
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
      console.error('Error reacting to book:', error);
      showToast('Ошибка при добавлении реакции', 'error');
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

  // Группировка книг по статусам
  const booksByStatus = {
    want_to_read: books.filter(book => book.status === 'want_to_read'),
    reading: books.filter(book => book.status === 'reading'),
    read: books.filter(book => book.status === 'read'),
    dropped: books.filter(book => book.status === 'dropped')
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
    <div className={`min-h-screen bg-gradient-to-br from-[#1a1625] to-[#2d1b4e] ${theme} flex flex-col`}>
      <header className="bg-[#1a0f2e]/85 backdrop-blur-xl border-b border-[#8458B3]/30 sticky top-0 z-50 flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <a href="/index.html" className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d0bdf4] via-[#a0d2eb] to-[#8458B3] active:scale-95 transition-transform cursor-pointer">🎮 GameTracker</a>
              
              {/* Кнопки навигации */}
              <div className="flex gap-2">
                <a
                  href="/index.html"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  🎮 Game
                </a>
                <a
                  href="/movies.html"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🎬 Movie
                </a>
                <span className="px-4 py-2 bg-green-600 text-white rounded-lg">
                  📚 Book
                </span>
              </div>
              
              {/* Красивая разделительная линия */}
              <div className="h-8 w-px bg-gradient-to-b from-transparent via-[#a0d2eb]/80 to-transparent opacity-80 ml-2"></div>
              <a href="./books.html" className="inline-flex items-center gap-2 active:scale-95 transition-transform">
                <svg className="w-7 h-7" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <defs><linearGradient id="bookGradHeaderReact" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient></defs>
                  <path fill="url(#bookGradHeaderReact)" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm2 0v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h4v2H8v-2z"/>
                </svg>
                <span className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] via-[#3b82f6] to-[#0ea5e9]">BookTracker</span>
              </a>
            </div>
            {user && (
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-[#10b981]/25 to-[#3b82f6]/20 rounded-lg border border-[#3b82f6]/40">
                        <Avatar src={user.avatar} size="sm" />
                        <span className="text-white font-semibold text-sm md:text-base block">{user.username}</span>
                    </div>
                    <Fragment>
                        <button onClick={() => setShowSearchModal(true)} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30" title="Найти книгу">
                            <Icon name="search" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                        </button>
                        <button onClick={() => setShowStatistics(true)} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30" title="Статистика книг">
                            <Icon name="barChart" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                        </button>
                        <button onClick={() => setShowProfile(true)} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30">
                            <Icon name="settings" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                        </button>
                        <button onClick={() => { setShowUserHub(true); }} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30 relative">
                            <Icon name="users" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                            {friendRequests.length > 0 && <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white badge-notification"></span>}
                        </button>
                    </Fragment>
                    <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30 relative">
                        <Icon name="bell" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                    </button>
                </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 space-y-8">
        {/* Поиск по своим книгам */}
        <div className="relative">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold text-white">Найти в моих книгах</h2>
            <button
              onClick={() => setShowMyBooksSearch(!showMyBooksSearch)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {showMyBooksSearch ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          
          {showMyBooksSearch && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-green-500/30">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={myBooksSearchQuery}
                  onChange={(e) => {
                    setMyBooksSearchQuery(e.target.value);
                    searchMyBooks(e.target.value);
                  }}
                  placeholder="Поиск по названию или автору..."
                  className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:outline-none"
                />
                {myBooksSearching && <Icon name="loader" className="w-6 h-6 text-green-500 animate-spin" />}
              </div>
              
              {myBooksSearchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myBooksSearchResults.map((book) => (
                    <div key={book.id} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                      <div className="flex gap-3">
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64"><rect width="48" height="64" fill="%23374151"/><text x="24" y="35" text-anchor="middle" fill="%239ca3af" font-size="12">📚</text></svg>';
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-sm line-clamp-2">{book.title}</h3>
                          <p className="text-gray-400 text-xs">{book.author}</p>
                          <span className="inline-block px-2 py-1 bg-green-600 text-white text-xs rounded mt-1">
                            {book.status === 'want_to_read' && 'Хочу прочитать'}
                            {book.status === 'reading' && 'Читаю'}
                            {book.status === 'read' && 'Прочитал'}
                            {book.status === 'dropped' && 'Бросил'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Доска книг */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {books.length === 0 && (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-white mb-2">У вас пока нет книг</h3>
              <p className="text-gray-400 mb-4">Добавьте книги, чтобы начать отслеживать свой прогресс чтения</p>
              <button
                onClick={() => setShowSearchModal(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Найти книгу
              </button>
            </div>
          )}
          <BookColumn
            title="Хочу прочитать"
            books={booksByStatus.want_to_read}
            onDrop={(book) => updateBookStatus(book.id, 'want_to_read')}
            onEdit={(book) => {
              setEditingBook(book);
              setShowEditModal(true);
            }}
            onDelete={deleteBook}
            onRate={rateBook}
            onReact={reactToBook}
            onMove={updateBookStatus}
          />
          
          <BookColumn
            title="Читаю"
            books={booksByStatus.reading}
            onDrop={(book) => updateBookStatus(book.id, 'reading')}
            onEdit={(book) => {
              setEditingBook(book);
              setShowEditModal(true);
            }}
            onDelete={deleteBook}
            onRate={rateBook}
            onReact={reactToBook}
            onMove={updateBookStatus}
          />
          
          <BookColumn
            title="Прочитал"
            books={booksByStatus.read}
            onDrop={(book) => updateBookStatus(book.id, 'read')}
            onEdit={(book) => {
              setEditingBook(book);
              setShowEditModal(true);
            }}
            onDelete={deleteBook}
            onRate={rateBook}
            onReact={reactToBook}
            onMove={updateBookStatus}
          />
          
          <BookColumn
            title="Бросил"
            books={booksByStatus.dropped}
            onDrop={(book) => updateBookStatus(book.id, 'dropped')}
            onEdit={(book) => {
              setEditingBook(book);
              setShowEditModal(true);
            }}
            onDelete={deleteBook}
            onRate={rateBook}
            onReact={reactToBook}
            onMove={updateBookStatus}
          />
        </div>

        {/* Активность друзей */}
        {activities.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-green-500/30">
            <h2 className="text-xl font-semibold text-white mb-4">Активность друзей по книгам</h2>
            <div className="space-y-3">
              {activities.slice(0, 12).map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                  <Avatar src={activity.user?.avatar} size="sm" />
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      <span className="font-semibold">{activity.user?.username || 'Неизвестный пользователь'}</span>
                      {' '}
                      {activity.action === 'added' && 'добавил книгу'}
                      {activity.action === 'moved' && 'переместил книгу'}
                      {activity.action === 'rated' && 'оценил книгу'}
                      {' '}
                      <span className="text-green-400">{activity.book?.title || 'Неизвестная книга'}</span>
                    </p>
                    <p className="text-gray-400 text-xs">{new Date(activity.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Модальные окна */}
      <BookSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddBook={addBook}
      />
    </div>
  );
};

// Рендер приложения
ReactDOM.render(<BookTrackerApp />, document.getElementById('root'));
