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

// --- OpenLibrary API интеграция ---
const OpenLibraryAPI = {
  // Поиск книг по названию или автору
  async searchBooks(query, limit = 10) {
    try {
      const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      return data.docs || [];
    } catch (error) {
      console.error('OpenLibrary search error:', error);
      return [];
    }
  },

  // Получение обложки книги
  getCoverUrl(book, size = 'M') {
    if (!book) return null;
    
    // Пробуем разные идентификаторы для обложки
    const identifiers = [
      book.isbn?.[0],
      book.isbn?.[1], 
      book.isbn?.[2],
      book.oclc?.[0],
      book.lccn?.[0],
      book.olid
    ].filter(Boolean);

    for (const id of identifiers) {
      if (id.startsWith('978') || id.startsWith('979')) {
        // ISBN
        return `https://covers.openlibrary.org/b/isbn/${id}-${size}.jpg`;
      } else if (id.startsWith('OL')) {
        // OLID
        return `https://covers.openlibrary.org/b/olid/${id}-${size}.jpg`;
      } else if (id.startsWith('OCLC')) {
        // OCLC
        return `https://covers.openlibrary.org/b/oclc/${id}-${size}.jpg`;
      } else if (id.startsWith('LCCN')) {
        // LCCN
        return `https://covers.openlibrary.org/b/lccn/${id}-${size}.jpg`;
      }
    }

    // Если ничего не найдено, возвращаем дефолтную обложку
    return `https://covers.openlibrary.org/b/id/${book.cover_i || 'default'}-${size}.jpg`;
  },

  // Нормализация данных книги
  normalizeBook(book) {
    return {
      id: book.key || `book_${Date.now()}_${Math.random()}`,
      title: book.title || 'Без названия',
      author: book.author_name?.[0] || book.author_name || 'Неизвестный автор',
      year: book.first_publish_year || book.publish_year?.[0] || null,
      isbn: book.isbn?.[0] || null,
      coverUrl: this.getCoverUrl(book),
      description: book.first_sentence?.[0] || null,
      pages: book.number_of_pages_median || null,
      subjects: book.subject || [],
      language: book.language?.[0] || 'ru'
    };
  }
};

// --- Переиспользуемые UI-компоненты ---

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
      const normalizedBooks = books.map(book => OpenLibraryAPI.normalizeBook(book));
      setResults(normalizedBooks);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Перенаправление...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen book-tracker-bg ${theme}`}>
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold title-books">📚 Книги</h1>
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
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSearchModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🔍 Найти книгу
              </button>
              
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                title="Сменить тему"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>

              {user && (
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar || '/images/default-avatar.png'}
                    alt={user.username}
                    className="w-8 h-8 rounded-full avatar-border"
                  />
                  <span className="text-gray-700 font-medium">{user.username}</span>
                  <button
                    onClick={handleLogout}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-books-want p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{booksByStatus.want_to_read.length}</div>
            <div className="text-white/80">Хочу прочитать</div>
          </div>
          <div className="stat-books-reading p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{booksByStatus.reading.length}</div>
            <div className="text-white/80">Читаю</div>
          </div>
          <div className="stat-books-read p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{booksByStatus.read.length}</div>
            <div className="text-white/80">Прочитал</div>
          </div>
          <div className="stat-books-dropped p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{booksByStatus.dropped.length}</div>
            <div className="text-white/80">Бросил</div>
          </div>
        </div>

        {/* Доска книг */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
