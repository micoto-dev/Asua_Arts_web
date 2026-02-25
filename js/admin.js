/**
 * Asua Arts - Admin News Management
 */

// SHA-256 hash of the admin password
// Default password: "asuaarts2026"
var PASSWORD_HASH = 'f2a145df8433ddd694635fb03545d3dad2e5a79c720016a975ac78ed9610ff2e';

var newsData = [];
var deleteTargetId = null;

document.addEventListener('DOMContentLoaded', function() {
  initLogin();
  initAdminUI();
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
    document.getElementById('articleContent').value = article.content || '';
  } else {
    title.textContent = '記事を作成';
    document.getElementById('articleId').value = '';
    document.getElementById('articleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('articleCategory').value = 'お知らせ';
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleContent').value = '';
  }

  modal.classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

function saveArticle() {
  var id = document.getElementById('articleId').value;
  var date = document.getElementById('articleDate').value;
  var category = document.getElementById('articleCategory').value;
  var articleTitle = document.getElementById('articleTitle').value.trim();
  var content = document.getElementById('articleContent').value.trim();

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
