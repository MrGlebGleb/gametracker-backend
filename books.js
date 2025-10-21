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
const BookSearchModal = ({ isOpen, onClose, onAddBook, status = 'want_to_read' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const searchBooks = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
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

  // Автопоиск с debounce
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchBooks();
    }, 300); // Задержка 300мс

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleAddBook = () => {
    if (selectedBook) {
      onAddBook(selectedBook, status);
      onClose();
      setSelectedBook(null);
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
            <h2 className="text-2xl font-bold text-white">Поиск книг</h2>
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
              placeholder="Введите название книги или автора..."
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
              <span className="ml-3 text-gray-600">Поиск книг...</span>
            </div>
          ) : results.length > 0 ? (
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

// Компонент модального окна для деталей книги
function BookDetailsModal({ book, onClose, onUpdate, onReact, user }) {
  if (!book) return null;
  const userReaction = (book.reactions || []).find(r => r.user_id === user?.id);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-[#1a0f2e]/95 backdrop-blur-xl border border-[#8458B3]/50 modal-bg rounded-2xl p-6 w-full max-w-md border border-purple-500/30 max-h-[90vh] overflow-y-auto elevation-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{book.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg"><Icon name="x" className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-2">Рейтинг:</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onUpdate(book, { rating: star })}
                  className={`w-6 h-6 transition-colors ${
                    star <= (book.user_rating || 0)
                      ? 'text-yellow-400 hover:text-yellow-300'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Icon name="star" className="w-full h-full" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-sm">Отзыв:</label>
            <textarea 
              defaultValue={book.review || ''} 
              onBlur={(e) => onUpdate(book, { review: e.target.value })} 
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white mt-1" 
              rows="4" 
              placeholder="Ваши впечатления..."
            />
          </div>

          <div>
            <p className="text-gray-400 text-sm mb-2">Ваша реакция:</p>
            <div className="flex flex-wrap gap-2">
              {REACTION_EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  data-reaction-emoji={emoji}
                  onClick={() => onReact(book, emoji)} 
                  className={`text-2xl reaction-button p-1 rounded-full ${userReaction?.emoji === emoji ? 'bg-purple-500/30' : 'hover:bg-gray-700/50'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          {book.reactions && book.reactions.length > 0 && (
            <div>
              <p className="text-gray-400 text-sm mb-2">Все реакции:</p>
              <div className="flex flex-wrap gap-2">
                {book.reactions.map((reaction, index) => (
                  <span key={index} className="text-sm text-gray-300">
                    {reaction.emoji} {reaction.username}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Компонент карточки книги (скопирован с MediaCard из movies.js)
function BookCard({ book, onEdit, onDelete, onRate, onReact, onMove, onSelect }) {
  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify(book));
      }}
      onClick={() => {
        // Открываем модальное окно для редактирования/оценки
        onSelect(book);
      }}
      data-card-id={book.id}
      className="bg-[#1a0f2e]/70 rounded-xl border border-[#8458B3]/30 hover:border-[#a0d2eb] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(160,210,235,0.4)] transition-all duration-200 cursor-pointer flex gap-3 p-2 group relative elevation-1 hover:elevation-2 shadow-transition media-card backdrop-blur-xl"
    >
      {/* Цветная полоска слева */}
      <div 
        className="w-1 rounded-l-xl flex-shrink-0" 
        style={{ backgroundColor: '#10b981', opacity: 0.8, boxShadow: '0 0 10px currentColor' }}
      ></div>
      <div className="relative flex-shrink-0">
        <img 
          src={book.coverUrl || 'https://placehold.co/96x128/1f2937/ffffff?text=📚'} 
          alt={book.title} 
          className="w-16 h-24 object-cover rounded-lg flex-shrink-0" 
          onError={(e) => {
            console.log('❌ Image failed to load:', {
              coverUrl: book.coverUrl,
              title: book.title,
              error: e.target.error,
              currentSrc: e.target.currentSrc
            });
            e.target.src = 'https://placehold.co/96x128/1f2937/ffffff?text=📚';
          }}
          onLoad={() => {
            console.log('✅ Image loaded successfully:', {
              coverUrl: book.coverUrl,
              title: book.title,
              currentSrc: book.coverUrl
            });
          }}
        />
      </div>
      <div className="flex flex-col justify-between flex-grow min-w-0 py-1">
        <div>
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1" style={{fontWeight: '600'}}>{book.title}</h3>
          {book.year && <p className="text-xs" style={{color: 'rgba(208, 189, 244, 0.8)'}}>{book.year}</p>}
          <p className="text-xs text-gray-400 mb-1">{book.author}</p>
          {/* Рейтинг под названием */}
          {book.user_rating && book.user_rating > 0 && (
            <div className="flex gap-0.5 mt-1">
              {[...Array(5)].map((_, i) => (
                <Icon 
                  key={i} 
                  name="star" 
                  className={`w-3 h-3 ${i < book.user_rating ? 'text-[#a0d2eb]' : 'text-[#8458B3]/30'}`} 
                  style={i < book.user_rating ? {filter: 'drop-shadow(0 0 4px rgba(160, 210, 235, 0.5))'} : {}} 
                />
              ))}
            </div>
          )}
        </div>
        {book.reactions && book.reactions.length > 0 && (
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            {(() => {
              // Группируем реакции по emoji
              const groupedReactions = {};
              book.reactions.forEach(r => {
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
              book.reactions.forEach(r => {
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
          onDelete(book.id);
        }} 
        className="absolute top-1 right-1 p-1.5 bg-red-600/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity self-start flex-shrink-0 z-10"
      >
        <Icon name="x" className="w-3 h-3 text-white" />
      </button>
    </div>
  );
}

// Компонент колонки
const BookColumn = ({ title, status, books, onDrop, onEdit, onDelete, onRate, onReact, onMove, onAddBook, onSelect }) => {
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

  // Определяем цвета для разных статусов
  const getColumnColors = (status) => {
    switch (status) {
      case 'want_to_read':
        return {
          bg: 'bg-gradient-to-b from-emerald-500/20 to-teal-500/20',
          border: 'border-emerald-500/30',
          text: 'text-emerald-300',
          button: 'bg-emerald-600 hover:bg-emerald-700'
        };
      case 'reading':
        return {
          bg: 'bg-gradient-to-b from-cyan-500/20 to-blue-500/20',
          border: 'border-cyan-500/30',
          text: 'text-cyan-300',
          button: 'bg-cyan-600 hover:bg-cyan-700'
        };
      case 'read':
        return {
          bg: 'bg-gradient-to-b from-green-500/20 to-emerald-500/20',
          border: 'border-green-500/30',
          text: 'text-green-300',
          button: 'bg-green-600 hover:bg-green-700'
        };
      case 'dropped':
        return {
          bg: 'bg-gradient-to-b from-red-500/20 to-pink-500/20',
          border: 'border-red-500/30',
          text: 'text-red-300',
          button: 'bg-red-600 hover:bg-red-700'
        };
      default:
        return {
          bg: 'bg-gradient-to-b from-gray-500/20 to-gray-600/20',
          border: 'border-gray-500/30',
          text: 'text-gray-300',
          button: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  const colors = getColumnColors(status);

  return (
    <div
      className={`board-column ${colors.bg} ${colors.border} border rounded-lg p-4 min-h-96 backdrop-blur-sm ${
        isDragOver ? 'drag-over-column' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold ${colors.text}`}>{title}</h2>
        <button
          onClick={onAddBook}
          className={`${colors.button} text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors hover:scale-105 active:scale-95`}
          title="Добавить книгу"
        >
          +
        </button>
      </div>
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
            onSelect={onSelect}
          />
        ))}
        {books.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-sm">Перетащите книгу сюда</p>
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
  const [activities, setActivities] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('want_to_read');
  const [selectedBook, setSelectedBook] = useState(null);

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
      console.log('No token found, skipping books load');
      setLoading(false);
      return;
    }

    console.log('Loading books with token:', token.substring(0, 10) + '...');
    
    try {
      const response = await fetch(`${API_URL}/api/books`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Books API response status:', response.status);
      
      if (response.ok) {
        const booksData = await response.json();
        console.log('Loaded books:', booksData.length);
        console.log('Books data:', booksData);
        setBooks(booksData);
      } else if (response.status === 401) {
        console.log('Token invalid, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      } else {
        console.error('Books API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
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

  const addBook = async (bookData, status = 'want_to_read') => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for adding book');
      return;
    }

    console.log('Adding book:', bookData, 'with status:', status);
    
    try {
      const response = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...bookData,
          status: status
        })
      });

      console.log('Add book response status:', response.status);
      
      if (response.ok) {
        const newBook = await response.json();
        console.log('Book added successfully:', newBook);
        setBooks(prev => [...prev, newBook]);
        showToast('Книга добавлена!', 'success');
      } else {
        const errorText = await response.text();
        console.error('Add book error:', response.status, errorText);
        showToast('Ошибка при добавлении книги', 'error');
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

  const updateBook = async (book, updates) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/books/${book.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedBook = await response.json();
        setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
        showToast('Книга обновлена!', 'success');
      }
    } catch (error) {
      console.error('Error updating book:', error);
      showToast('Ошибка при обновлении книги', 'error');
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

  const handleNotifications = () => {
    setShowNotifications(!showNotifications);
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
            <div className="flex items-center gap-4">
              {/* Кнопки навигации */}
              <div className="flex gap-4">
                <a
                  href="/index.html"
                  className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 hover:scale-105 transition-transform cursor-pointer"
                >
                  🎮 GameTracker
                </a>
                <a
                  href="/movies.html"
                  className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 hover:scale-105 transition-transform cursor-pointer"
                >
                  🎬 MovieTracker
                </a>
                <span className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">
                  📚 BookTracker
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
                        <button onClick={() => setShowSearchModal(true)} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30" title="Найти книгу">
                            <Icon name="search" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                        </button>
                        <button onClick={handleStatistics} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30" title="Статистика книг">
                            <Icon name="barChart" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                        </button>
                        <button onClick={handleProfile} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30">
                            <Icon name="settings" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                        </button>
                        <button onClick={handleUserHub} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30 relative">
                            <Icon name="users" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                            {friendRequests.length > 0 && <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white badge-notification"></span>}
                        </button>
                    </Fragment>
                    <button onClick={handleNotifications} className="p-2 hover:bg-gray-800 rounded-lg border border-green-500/30 relative">
                        <Icon name="bell" className="w-4 h-4 md:w-5 md:h-5 text-[#10b981] hover:text-[#3b82f6] hover:scale-110 transition-all header-icon" />
                    </button>
                </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 space-y-8">
        {/* Поиск по своим книгам */}
        <div className="relative max-w-md">
          <div className="bg-gray-800/25 backdrop-blur-sm rounded-lg p-3 border border-green-500/15">
            <div className="flex gap-2">
              <input
                type="text"
                value={myBooksSearchQuery}
                onChange={(e) => {
                  setMyBooksSearchQuery(e.target.value);
                  searchMyBooks(e.target.value);
                }}
                placeholder="Найти в моих книгах..."
                className="flex-1 px-3 py-2 bg-gray-700/30 border border-gray-600/50 rounded-lg text-white/80 placeholder-gray-500 focus:border-green-500/50 focus:outline-none text-sm"
              />
              {myBooksSearching && <Icon name="loader" className="w-5 h-5 text-green-500 animate-spin" />}
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
        </div>

        {/* Доска книг */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BookColumn
            title="📖 Хочу прочитать"
            status="want_to_read"
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
            onAddBook={() => {
              setSelectedStatus('want_to_read');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedBook}
          />
          
          <BookColumn
            title="📚 Читаю"
            status="reading"
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
            onAddBook={() => {
              setSelectedStatus('reading');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedBook}
          />
          
          <BookColumn
            title="✅ Прочитал"
            status="read"
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
            onAddBook={() => {
              setSelectedStatus('read');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedBook}
          />
          
          <BookColumn
            title="❌ Бросил"
            status="dropped"
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
            onAddBook={() => {
              setSelectedStatus('dropped');
              setShowSearchModal(true);
            }}
            onSelect={setSelectedBook}
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
        status={selectedStatus}
      />
      
      <BookDetailsModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onUpdate={updateBook}
        onReact={reactToBook}
        user={user}
      />
    </div>
  );
};

// Рендер приложения
ReactDOM.render(<BookTrackerApp />, document.getElementById('root'));
