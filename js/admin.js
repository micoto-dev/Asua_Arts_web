/**
 * Asua Arts - Admin News Management
 * Rich Text Editor (Quill.js) Integration
 */

// SHA-256 hash of the admin password
// Default password: "asuaarts2026"
var PASSWORD_HASH = 'f2a145df8433ddd694635fb03545d3dad2e5a79c720016a975ac78ed9610ff2e';

var newsData = [];
var deleteTargetId = null;
var quillEditor = null;

// Maximum image width for compression
var IMAGE_MAX_WIDTH = 800;
var IMAGE_QUALITY = 0.7;

document.addEventListener('DOMContentLoaded', function() {
  initLogin();
  initAdminUI();
  initQuillEditor();
});

/**
 * SHA-256 Hashing
 */
function sha256(message) {
  var msgBuffer = new TextEncoder().encode(message);
  return crypto.subtle.digest('SHA-256', msgBuffer).then(function(hashBuffer) {
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

/**
 * Generate password hash (for setup - call from console)
 * Usage: generateHash('your-password').then(console.log)
 */
function generateHash(password) {
  return sha256(password).then(function(hash) {
    console.log('Password hash:', hash);
    return hash;
  });
}

/**
 * Login
 */
function initLogin() {
  var loginForm = document.getElementById('loginForm');
  var passwordInput = document.getElementById('passwordInput');
  var loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var password = passwordInput.value;

    sha256(password).then(function(hash) {
      if (hash === PASSWORD_HASH) {
        sessionStorage.setItem('admin_auth', 'true');
        showAdminScreen();
        loginError.style.display = 'none';
      } else {
        loginError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
      }
    });
  });

  // Check existing session
  if (sessionStorage.getItem('admin_auth') === 'true') {
    showAdminScreen();
  }
}

function showAdminScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminScreen').style.display = 'block';
  loadNewsFromServer();
}

/**
 * Load news.json from server
 */
function loadNewsFromServer() {
  fetch('data/news.json?t=' + Date.now())
    .then(function(response) { return response.json(); })
    .then(function(data) {
      newsData = data.news || [];
      renderNewsTable();
      showToast('news.json を読み込みました');
    })
    .catch(function() {
      newsData = [];
      renderNewsTable();
    });
}

/**
 * Initialize Quill Rich Text Editor
 */
function initQuillEditor() {
  // Register custom video blot for iframe embedding
  var BlockEmbed = Quill.import('blots/block/embed');

  function VideoBlot() {
    return Reflect.construct(BlockEmbed, arguments, VideoBlot);
  }
  Object.setPrototypeOf(VideoBlot.prototype, BlockEmbed.prototype);
  Object.setPrototypeOf(VideoBlot, BlockEmbed);

  VideoBlot.blotName = 'videoEmbed';
  VideoBlot.tagName = 'iframe';
  VideoBlot.className = 'ql-video-embed';

  VideoBlot.create = function(url) {
    var node = BlockEmbed.create.call(this);
    node.setAttribute('src', url);
    node.setAttribute('frameborder', '0');
    node.setAttribute('allowfullscreen', 'true');
    node.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    node.setAttribute('width', '100%');
    node.setAttribute('height', '360');
    node.setAttribute('style', 'max-width:100%;aspect-ratio:16/9;');
    return node;
  };

  VideoBlot.value = function(node) {
    return node.getAttribute('src');
  };

  VideoBlot.formats = function(node) {
    return {
      src: node.getAttribute('src'),
      width: node.getAttribute('width'),
      height: node.getAttribute('height')
    };
  };

  Quill.register(VideoBlot);

  quillEditor = new Quill('#articleContent', {
    theme: 'snow',
    placeholder: '記事の本文を入力...',
    modules: {
      toolbar: {
        container: [
          [{ 'header': [2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['link', 'image', 'video'],
          ['clean']
        ],
        handlers: {
          'image': imageHandler,
          'video': videoHandler
        }
      }
    }
  });
}

/**
 * Image Handler: file select -> compress -> insert as Base64
 */
function imageHandler() {
  var input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();

  input.addEventListener('change', function() {
    var file = input.files[0];
    if (!file) return;

    // Check file size (warn if > 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      if (!confirm('画像サイズが5MBを超えています。圧縮して挿入しますか？')) return;
    }

    compressImage(file).then(function(dataUrl) {
      var range = quillEditor.getSelection(true);
      quillEditor.insertEmbed(range.index, 'image', dataUrl);
      quillEditor.setSelection(range.index + 1);
    }).catch(function() {
      showToast('画像の読み込みに失敗しました');
    });
  });
}

/**
 * Compress image using Canvas API
 * Returns a Promise that resolves with a Base64 data URL
 */
function compressImage(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var width = img.width;
        var height = img.height;

        // Scale down if wider than max width
        if (width > IMAGE_MAX_WIDTH) {
          height = Math.round(height * (IMAGE_MAX_WIDTH / width));
          width = IMAGE_MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG for compression (PNG files with transparency will lose it)
        var dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Video Handler: prompt for URL -> convert to embed -> insert iframe
 */
function videoHandler() {
  var url = prompt('YouTube または Vimeo のURLを入力してください:');
  if (!url) return;

  var embedUrl = convertToEmbedUrl(url.trim());
  if (!embedUrl) {
    showToast('対応していないURLです（YouTube/Vimeoのみ対応）');
    return;
  }

  var range = quillEditor.getSelection(true);
  quillEditor.insertEmbed(range.index, 'videoEmbed', embedUrl);
  quillEditor.setSelection(range.index + 1);
}

/**
 * Convert YouTube/Vimeo URL to embed URL
 */
function convertToEmbedUrl(url) {
  // YouTube patterns
  var youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (var i = 0; i < youtubePatterns.length; i++) {
    var match = url.match(youtubePatterns[i]);
    if (match) {
      return 'https://www.youtube.com/embed/' + match[1];
    }
  }

  // Vimeo patterns
  var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return 'https://player.vimeo.com/video/' + vimeoMatch[1];
  }

  return null;
}

/**
 * Check if content is plain text (no HTML tags)
 */
function isPlainText(content) {
  return !/<[a-z][\s\S]*>/i.test(content);
}

/**
 * Convert plain text to HTML for Quill editor
 */
function plainTextToHtml(text) {
  return text
    .split('\n')
    .map(function(line) { return '<p>' + escapeHtml(line || '') + '</p>'; })
    .join('');
}

/**
 * Admin UI Initialization
 */
function initAdminUI() {
  // Logout
  document.getElementById('btnLogout').addEventListener('click', function() {
    sessionStorage.removeItem('admin_auth');
    document.getElementById('adminScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
  });

  // New Article
  document.getElementById('btnNewArticle').addEventListener('click', function() {
    openEditModal();
  });

  // Export
  document.getElementById('btnExport').addEventListener('click', exportJSON);

  // Import
  document.getElementById('btnImport').addEventListener('click', function() {
    document.getElementById('importModal').classList.add('active');
  });

  // Save to Server
  document.getElementById('btnSaveServer').addEventListener('click', saveToServer);

  // Edit Modal
  document.getElementById('editModalClose').addEventListener('click', closeEditModal);
  document.getElementById('editModalCancel').addEventListener('click', closeEditModal);
  document.getElementById('editModalSave').addEventListener('click', saveArticle);

  // Confirm Modal
  document.getElementById('confirmModalClose').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmModalCancel').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmModalDelete').addEventListener('click', confirmDelete);

  // Import Modal
  document.getElementById('importModalClose').addEventListener('click', closeImportModal);
  document.getElementById('importModalCancel').addEventListener('click', closeImportModal);
  document.getElementById('importModalLoad').addEventListener('click', importJSON);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

/**
 * Render News Table
 */
function renderNewsTable() {
  var tbody = document.getElementById('newsTableBody');

  if (newsData.length === 0) {
    tbody.innerHTML = '<div class="news-table-empty">記事がありません。「新規作成」ボタンから記事を追加してください。</div>';
    return;
  }

  // Sort by date descending
  var sorted = newsData.slice().sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  var html = '';
  sorted.forEach(function(article) {
    html += '<div class="news-table-row" data-id="' + escapeHtml(article.id) + '">' +
      '<span class="date">' + escapeHtml(article.date) + '</span>' +
      '<span class="category">' + escapeHtml(article.category) + '</span>' +
      '<span class="title">' + escapeHtml(article.title) + '</span>' +
      '<span class="actions">' +
        '<button class="btn btn-secondary btn-sm btn-edit" data-id="' + escapeHtml(article.id) + '">編集</button>' +
        '<button class="btn btn-danger btn-sm btn-delete" data-id="' + escapeHtml(article.id) + '">削除</button>' +
      '</span>' +
    '</div>';
  });

  tbody.innerHTML = html;

  // Bind edit buttons
  tbody.querySelectorAll('.btn-edit').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-id');
      var article = newsData.find(function(a) { return a.id === id; });
      if (article) openEditModal(article);
    });
  });

  // Bind delete buttons
  tbody.querySelectorAll('.btn-delete').forEach(function(btn) {
    btn.addEventListener('click', function() {
      deleteTargetId = this.getAttribute('data-id');
      document.getElementById('confirmModal').classList.add('active');
    });
  });
}

/**
 * Edit Modal
 */
function openEditModal(article) {
  var modal = document.getElementById('editModal');
  var title = document.getElementById('editModalTitle');

  if (article) {
    title.textContent = '記事を編集';
    document.getElementById('articleId').value = article.id;
    document.getElementById('articleDate').value = article.date;
    document.getElementById('articleCategory').value = article.category;
    document.getElementById('articleTitle').value = article.title;

    // Handle backward compatibility: plain text -> HTML
    var content = article.content || '';
    if (isPlainText(content)) {
      quillEditor.root.innerHTML = plainTextToHtml(content);
    } else {
      quillEditor.root.innerHTML = content;
    }
  } else {
    title.textContent = '記事を作成';
    document.getElementById('articleId').value = '';
    document.getElementById('articleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('articleCategory').value = 'お知らせ';
    document.getElementById('articleTitle').value = '';
    quillEditor.root.innerHTML = '';
  }

  modal.classList.add('active');

  // Focus the editor after modal opens
  setTimeout(function() { quillEditor.focus(); }, 100);
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

function saveArticle() {
  var id = document.getElementById('articleId').value;
  var date = document.getElementById('articleDate').value;
  var category = document.getElementById('articleCategory').value;
  var articleTitle = document.getElementById('articleTitle').value.trim();

  // Get HTML content from Quill editor
  var content = quillEditor.root.innerHTML.trim();

  // Quill uses <p><br></p> for empty content
  if (content === '<p><br></p>' || content === '<p></p>') {
    content = '';
  }

  if (!date || !category || !articleTitle) {
    showToast('日付・カテゴリ・タイトルは必須です');
    return;
  }

  if (id) {
    // Edit existing
    var index = newsData.findIndex(function(a) { return a.id === id; });
    if (index !== -1) {
      newsData[index].date = date;
      newsData[index].category = category;
      newsData[index].title = articleTitle;
      newsData[index].content = content;
      showToast('記事を更新しました');
    }
  } else {
    // Create new
    var newId = date.replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);
    newsData.push({
      id: newId,
      date: date,
      category: category,
      title: articleTitle,
      content: content
    });
    showToast('記事を作成しました');
  }

  closeEditModal();
  renderNewsTable();
}

/**
 * Save to Server via PHP API
 */
function saveToServer() {
  var sorted = newsData.slice().sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  var jsonStr = JSON.stringify({ news: sorted }, null, 2);

  sha256(PASSWORD_HASH).then(function(token) {
    return fetch('api/save-news.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      body: jsonStr
    });
  }).then(function(response) {
    if (!response.ok) throw new Error('Server error: ' + response.status);
    return response.json();
  }).then(function(result) {
    if (result.success) {
      showToast('サーバーに保存しました');
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  }).catch(function(err) {
    showToast('サーバー保存に失敗しました。JSONダウンロードをお使いください。');
    console.error('Save to server failed:', err);
  });
}

/**
 * Delete
 */
function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
  deleteTargetId = null;
}

function confirmDelete() {
  if (!deleteTargetId) return;

  newsData = newsData.filter(function(a) { return a.id !== deleteTargetId; });
  closeConfirmModal();
  renderNewsTable();
  showToast('記事を削除しました');
}

/**
 * JSON Export
 */
function exportJSON() {
  var sorted = newsData.slice().sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  var jsonStr = JSON.stringify({ news: sorted }, null, 2);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'news.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('news.json をダウンロードしました');
}

/**
 * JSON Import
 */
function closeImportModal() {
  document.getElementById('importModal').classList.remove('active');
  document.getElementById('importFile').value = '';
}

function importJSON() {
  var fileInput = document.getElementById('importFile');
  var file = fileInput.files[0];

  if (!file) {
    showToast('ファイルを選択してください');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.news || !Array.isArray(data.news)) {
        showToast('不正なJSONフォーマットです');
        return;
      }
      newsData = data.news;
      renderNewsTable();
      closeImportModal();
      showToast('JSONファイルを読み込みました（' + newsData.length + '件）');
    } catch (err) {
      showToast('JSONの解析に失敗しました');
    }
  };
  reader.readAsText(file);
}

/**
 * Toast Notification
 */
function showToast(message) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');

  setTimeout(function() {
    toast.classList.remove('visible');
  }, 3000);
}

/**
 * HTML Escape
 */
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
