(function () {
  var THEME_KEY = "tengyou-theme";
  var SESSION_KEY = "tengyou-session";
  var ARTICLE_KEY = "tengyou-home-articles";
  var APPROVED_EMAIL = "871412257@qq.com";
  var HOME_PER_PAGE = 11;
  var RANK_PER_PAGE = 15;
  var RANK_MAX = 300;
  var BOARD_STORAGE_KEY = "tengyou-find-game-posts";
  var BOARD_POSTS_PER_PAGE = 15;

  window.TengyouSession = {
    get: function () {
      try {
        var raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (o && typeof o.username === "string" && o.username.trim()) {
          return { username: o.username.trim(), email: typeof o.email === "string" ? o.email.trim().toLowerCase() : "", loggedInAt: o.loggedInAt || 0 };
        }
      } catch (e) {}
      return null;
    },
    set: function (username, email) {
      var u = (username || "").trim();
      if (!u) return;
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username: u, email: (email || "").trim().toLowerCase(), loggedInAt: Date.now() })); } catch (e) {}
    },
    clear: function () { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} },
    isLoggedIn: function () { return !!this.get(); },
  };

  function initTheme() {
    try {
      var stored = localStorage.getItem(THEME_KEY);
      var theme = stored === "dark" || stored === "light" ? stored : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") || "light";
    try { localStorage.setItem(THEME_KEY, cur === "dark" ? "light" : "dark"); } catch (e) {}
    document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  }

  function containsForbiddenContent(text) {
    if (!text || typeof text !== "string") return false;
    var patterns = [ /magnet\s*:\s*\?/i, /magnet%3a%3f/i, /赌博|博彩|下注|彩票|代开/i, /色情|裸聊|成人视频|自拍偷拍/i, /毒品|吸毒|贩毒|冰毒|海洛因|大麻/i, /习近平|中国共产党|反党|推翻政权|台独|港独|疆独/i ];
    var compact = text.replace(/\s+/g, "");
    return patterns.some(function (re) { return re.test(text) || re.test(compact); });
  }

  function sanitizeText(s) { return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function stripTags(html) { return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function sanitizeHtmlRich(html) {
    var input = String(html || '');
    if (!input) return '';
    var root = document.createElement('div');
    root.innerHTML = input;
    var allowed = { a: 1, img: 1, span: 1, font: 1, div: 1, p: 1, strong: 1, b: 1, em: 1, i: 1, u: 1, ul: 1, ol: 1, li: 1, blockquote: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, br: 1 };
    var walk = function (node) {
      Array.prototype.slice.call(node.children || []).forEach(function (child) {
        var tag = child.tagName ? child.tagName.toLowerCase() : '';
        if (!allowed[tag]) {
          var parent = child.parentNode;
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
          parent.removeChild(child);
          walk(parent);
          return;
        }
        Array.prototype.slice.call(child.attributes || []).forEach(function (attr) {
          var name = attr.name.toLowerCase();
          if (name.indexOf('on') === 0) child.removeAttribute(attr.name);
          if (tag !== 'a' && tag !== 'img' && name === 'href') child.removeAttribute(attr.name);
          if (tag !== 'img' && name === 'src') child.removeAttribute(attr.name);
          if (name === 'style') {
            var style = attr.value || '';
            var keep = [];
            style.split(';').forEach(function (pair) {
              var idx = pair.indexOf(':');
              if (idx === -1) return;
              var k = pair.slice(0, idx).trim().toLowerCase();
              var v = pair.slice(idx + 1).trim();
              if (['color', 'background-color', 'font-size', 'text-align', 'font-weight', 'font-style', 'text-decoration'].indexOf(k) !== -1) keep.push(k + ': ' + v);
            });
            if (keep.length) child.setAttribute('style', keep.join('; ')); else child.removeAttribute('style');
          }
          if (name === 'target' && tag !== 'a') child.removeAttribute(attr.name);
          if (name === 'rel' && tag !== 'a') child.removeAttribute(attr.name);
        });
        if (tag === 'a') {
          var href = child.getAttribute('href') || '#';
          if (/^javascript:/i.test(href)) child.setAttribute('href', '#');
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
        if ((tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'blockquote' || tag === 'p' || tag === 'div' || tag === 'span') && !child.innerHTML.trim()) child.innerHTML = '<br>';
        walk(child);
      });
    };
    walk(root);
    return root.innerHTML;
  }
  function truncateTitle(t) { return String(t || "").replace(/\s+/g, " ").slice(0, 10); }

  function getArticles() {
    try {
      var raw = localStorage.getItem(ARTICLE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      if (Array.isArray(data)) {
        return data.map(function (a) {
          return { id: a.id != null ? a.id : Date.now() + Math.random(), title: a.title || "未命名文章", image: a.image || (Array.isArray(a.images) && a.images[0]) || "https://placehold.co/280x350/e5e7eb/374151?text=IMG", images: Array.isArray(a.images) ? a.images : (a.image ? [a.image] : []), body: a.body || "", bodyHtml: a.bodyHtml || "", ts: a.ts || 0, authorEmail: a.authorEmail || "", likes: typeof a.likes === "number" ? a.likes : 0, comments: Array.isArray(a.comments) ? a.comments : [], isPinned: !!a.isPinned };
        });
      }
    } catch (e) {}
    return [];
  }
  function saveArticles(articles) { try { localStorage.setItem(ARTICLE_KEY, JSON.stringify(articles)); } catch (e) {} }

  function getBoard() {
    try {
      var raw = localStorage.getItem(BOARD_STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : { posts: [] };
      var list = Array.isArray(data) ? data : data && Array.isArray(data.posts) ? data.posts : [];
      return { posts: list.map(function (p) { return { id: p.id != null ? p.id : Date.now() + Math.random(), nickname: p.nickname || "匿名旅人", body: p.body || "", ts: p.ts || 0, comments: Array.isArray(p.comments) ? p.comments : [] }; }) };
    } catch (e) {}
    return { posts: [] };
  }

  function saveBoard(board) { try { localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board)); } catch (e) {} }
  function formatTime(ts) { try { return new Date(ts).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  function isApprovedEditor(session) {
    return !!session && String(session.email || "").trim().toLowerCase() === APPROVED_EMAIL;
  }

  function getArticleStats(article) {
    var commentCount = Array.isArray(article.comments) ? article.comments.length : 0;
    return { likes: typeof article.likes === "number" ? article.likes : 0, comments: commentCount, heat: (typeof article.likes === "number" ? article.likes : 0) * 2 + commentCount };
  }

  function getSessionIdentity() {
    var session = window.TengyouSession.get();
    return session ? { username: session.username || '', email: String(session.email || '').trim().toLowerCase() } : null;
  }

  function isAdminEmail(email) {
    return String(email || '').trim().toLowerCase() === APPROVED_EMAIL;
  }

  function isSensitiveText(text) {
    var value = String(text || '');
    if (!value.trim()) return false;
    var compact = value.replace(/\s+/g, '');
    var patterns = [
      /magnet\s*:\s*\?/i,
      /magnet%3a%3f/i,
      /赌博|博彩|下注|彩票|赌钱|赌局/i,
      /色情|裸聊|成人视频|自拍偷拍|黄网|约炮/i,
      /毒品|吸毒|贩毒|冰毒|海洛因|大麻/i,
      /血腥|屠杀|碎尸|爆头|斩首|虐杀/i,
      /习近平|中国共产党|反党|推翻政权|台独|港独|疆独/i
    ];
    return patterns.some(function (re) { return re.test(value) || re.test(compact); });
  }

  function getCommentStats(comment) {
    return { likes: typeof comment.likes === 'number' ? comment.likes : 0, replies: Array.isArray(comment.replies) ? comment.replies.length : 0, heat: (typeof comment.likes === 'number' ? comment.likes : 0) * 2 + (Array.isArray(comment.replies) ? comment.replies.length : 0) };
  }

  function renderHomeArticles() {
    var list = document.getElementById("homeArticleList");
    if (!list) return;
    var pag = document.getElementById("homePagination");
    var posts = getArticles().slice().sort(function (a, b) { return (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0) || (b.ts || 0) - (a.ts || 0); });
    var total = posts.length;
    var totalPages = total ? Math.ceil(total / HOME_PER_PAGE) : 1;
    var page = parseInt(list.getAttribute("data-current-page") || "1", 10);
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    list.setAttribute("data-current-page", String(page));
    list.innerHTML = "";

    if (!total) {
      var empty = document.createElement("p");
      empty.className = "board-empty";
      empty.textContent = "暂无文章，点击上方发表文章按钮创建第一篇吧。";
      list.appendChild(empty);
    } else {
      posts.slice((page - 1) * HOME_PER_PAGE, page * HOME_PER_PAGE).forEach(function (a) {
        var stats = getArticleStats(a);
        var card = document.createElement("article");
        card.className = "article-card home-article-card";
        var thumb = document.createElement("div");
        thumb.className = "article-card__thumb";
        thumb.innerHTML = '<a href="article.html?id=' + encodeURIComponent(a.id) + '"><img src="' + a.image + '" alt="' + sanitizeText(a.title) + '" loading="lazy" /></a>';
        var body = document.createElement("div");
        body.className = "article-card__body";
        var previewText = stripTags(a.bodyHtml || a.body || '');
        previewText = previewText.replace(/\s+/g, ' ').trim();
        if (!previewText) previewText = '暂无正文预览';
        body.innerHTML = '<div class="article-card__head"><h2 class="article-card__title"><a href="article.html?id=' + encodeURIComponent(a.id) + '">' + sanitizeText(a.title) + '</a></h2></div><div class="article-card__excerpt article-card__excerpt--home article-card__excerpt--plain">' + sanitizeText(previewText) + '</div><div class="article-card__footer"><div class="article-card__meta article-card__meta--bottom"><span>点赞 ' + stats.likes + '</span><span>评论 ' + stats.comments + '</span></div><div class="article-card__footer-right"><div class="article-card__manage-actions article-card__manage-actions--right">' + (window.TengyouSession.get() && window.TengyouSession.get().email === APPROVED_EMAIL ? '<button type="button" class="article-card__manage-btn" data-home-manage="edit" data-article-id="' + a.id + '">编辑</button><button type="button" class="article-card__manage-btn article-card__manage-btn--danger" data-home-manage="delete" data-article-id="' + a.id + '">删除</button><button type="button" class="article-card__manage-btn" data-home-manage="pin" data-article-id="' + a.id + '">' + (a.isPinned ? '取消置顶' : '置顶') + '</button>' : '') + '</div><button type="button" class="board-post__like-btn" data-like-article="' + a.id + '">点赞</button></div></div>';
        card.appendChild(thumb); card.appendChild(body); list.appendChild(card);
      });
    }

    if (pag) {
      pag.innerHTML = "";
      pag.hidden = total <= HOME_PER_PAGE;
      if (!pag.hidden) for (var i = 1; i <= totalPages; i++) { var btn = document.createElement("button"); btn.type = "button"; btn.className = "board-pagination__btn" + (i === page ? " board-pagination__btn--current" : ""); btn.textContent = String(i); btn.setAttribute("data-home-page", String(i)); pag.appendChild(btn); }
    }
  }

  function getRankingArticles() {
    return getArticles().slice().sort(function (a, b) {
      var sa = getArticleStats(a), sb = getArticleStats(b);
      return sb.heat - sa.heat || (b.ts || 0) - (a.ts || 0);
    }).slice(0, RANK_MAX).map(function (a, idx) { var s = getArticleStats(a); return { rank: idx + 1, id: a.id, title: a.title, titleShort: truncateTitle(a.title), heat: s.heat, likes: s.likes, comments: s.comments }; });
  }

  function renderHotRankHome() {
    var root = document.getElementById("hotRankHome");
    var more = document.getElementById("hotRankMoreBtn");
    if (!root) return;
    var items = getRankingArticles().slice(0, 10);
    root.innerHTML = "";
    items.forEach(function (item) {
      var row = document.createElement("a");
      row.className = "hot-rank__item";
      row.href = "article.html?id=" + encodeURIComponent(item.id);
      row.innerHTML = '<span class="hot-rank__num">' + item.rank + '</span><span class="hot-rank__title">' + sanitizeText(item.titleShort) + '</span><span class="hot-rank__heat">' + item.heat + '</span>';
      root.appendChild(row);
    });
    if (more) more.href = "ranking.html";
  }

  function updateBreadcrumb(node) {
    if (!node) return;
    var items = [];
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) items.push(arguments[i]);
    }
    node.innerHTML = items.map(function (item, idx) {
      if (idx === items.length - 1) return '<span class="breadcrumb__current">' + sanitizeText(item.label) + '</span>';
      return '<a href="' + item.href + '">' + sanitizeText(item.label) + '</a>';
    }).join('<span class="breadcrumb__sep">›</span>');
  }

  function getSearchResults(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return getArticles().filter(function (a) { return String(a.title || "").toLowerCase().indexOf(q) !== -1; }).sort(function (a, b) { var sa = getArticleStats(a), sb = getArticleStats(b); return sb.heat - sa.heat || (b.ts || 0) - (a.ts || 0); });
  }

  function renderRankingPage() {
    var list = document.getElementById("rankingList");
    var pag = document.getElementById("rankingPagination");
    if (!list) return;
    var items = getRankingArticles();
    var page = parseInt(list.getAttribute("data-ranking-page") || "1", 10);
    var totalPages = Math.ceil(Math.min(items.length, RANK_MAX) / RANK_PER_PAGE) || 1;
    if (page < 1) page = 1; if (page > totalPages) page = totalPages;
    list.setAttribute("data-ranking-page", String(page));
    list.innerHTML = "";
    var slice = items.slice((page - 1) * RANK_PER_PAGE, page * RANK_PER_PAGE);
    slice.forEach(function (item) {
      var row = document.createElement("a");
      row.className = "ranking-row";
      row.href = "article.html?id=" + encodeURIComponent(item.id);
      row.innerHTML = '<span class="ranking-row__rank">' + item.rank + '</span><span class="ranking-row__title">' + sanitizeText(item.title) + '</span><span class="ranking-row__heat">热度 ' + item.heat + '</span>';
      list.appendChild(row);
    });
    if (pag) {
      pag.innerHTML = "";
      pag.hidden = items.length <= RANK_PER_PAGE;
      if (!pag.hidden) {
        for (var i = 1; i <= totalPages; i++) { var btn = document.createElement("button"); btn.type = "button"; btn.className = "board-pagination__btn" + (i === page ? " board-pagination__btn--current" : ""); btn.textContent = String(i); btn.setAttribute("data-ranking-page", String(i)); pag.appendChild(btn); }
      }
    }
  }

  function renderSearchPage() {
    var list = document.getElementById('searchResultList');
    var pag = document.getElementById('searchPagination');
    var bc = document.getElementById('searchBreadcrumb');
    if (!list) return;
    var q = new URLSearchParams(window.location.search).get('q') || '';
    var items = getSearchResults(q);
    if (bc) updateBreadcrumb(bc, { href: 'index.html', label: '首页' }, { label: '搜索：' + q });
    var page = parseInt(list.getAttribute('data-search-page') || '1', 10);
    var totalPages = items.length ? Math.ceil(items.length / RANK_PER_PAGE) : 1;
    if (page < 1) page = 1; if (page > totalPages) page = totalPages;
    list.setAttribute('data-search-page', String(page));
    list.innerHTML = '';
    if (!q) { list.innerHTML = '<p class="board-empty">请输入标题关键词后搜索。</p>'; }
    else if (!items.length) { list.innerHTML = '<p class="board-empty">没有找到匹配的文章。</p>'; }
    else {
      items.slice((page - 1) * RANK_PER_PAGE, page * RANK_PER_PAGE).forEach(function (item) {
        var card = document.createElement('article');
        card.className = 'article-card home-article-card';
        card.innerHTML = '<div class="article-card__thumb"><a href="article.html?id=' + encodeURIComponent(item.id) + '"><img src="' + item.image + '" alt="' + sanitizeText(item.title) + '"></a></div><div class="article-card__body"><h2 class="article-card__title"><a href="article.html?id=' + encodeURIComponent(item.id) + '">' + sanitizeText(item.title) + '</a></h2><div class="article-card__meta article-card__meta--bottom"><span>热度 ' + getArticleStats(item).heat + '</span></div></div>';
        list.appendChild(card);
      });
    }
    if (pag) {
      pag.innerHTML = '';
      pag.hidden = items.length <= RANK_PER_PAGE;
      if (!pag.hidden) for (var i = 1; i <= totalPages; i++) { var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'board-pagination__btn' + (i === page ? ' board-pagination__btn--current' : ''); btn.textContent = String(i); btn.setAttribute('data-search-page', String(i)); pag.appendChild(btn); }
    }
  }

  function renderArticlePage() {
    var root = document.getElementById("articlePage");
    if (!root) return;
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    var articles = getArticles();
    var article = articles.filter(function (a) { return String(a.id) === String(id); })[0];
    if (!article) { root.innerHTML = '<p class="board-empty">文章不存在。</p>'; return; }
    var user = window.TengyouSession.get();
    root.innerHTML = '';

    var crumb = document.createElement('div');
    crumb.className = 'article-breadcrumb';
    updateBreadcrumb(crumb, { href: 'index.html', label: '首页' }, { href: 'index.html', label: '文章列表' }, { label: article.title });
    root.appendChild(crumb);

    var nav = document.createElement('div');
    nav.className = 'article-detail__nav';
    nav.innerHTML = '<a class="article-like-btn" href="index.html">返回首页</a><a class="article-like-btn" href="ranking.html">查看排行</a><button type="button" class="article-like-btn" id="backBtn">返回上一页</button>';
    root.appendChild(nav);

    var detail = document.createElement('section');
    detail.className = 'content-section article-detail';
    var pinnedBadge = article.isPinned ? '<span class="article-pin-badge">置顶</span>' : '';
    var manageBar = '';
    var galleryHtml = '';
    var imagesForRender = Array.isArray(article.images) && article.images.length ? article.images : (article.image ? [article.image] : []);
    if (imagesForRender.length) {
      galleryHtml = '<div class="article-gallery">' + imagesForRender.map(function (src, idx) { return '<figure class="article-gallery__item' + (idx === 0 ? ' article-gallery__item--cover' : '') + '"><img src="' + src + '" alt="' + sanitizeText(article.title) + ' 图' + (idx + 1) + '"><figcaption>' + (idx === 0 ? '封面图' : '图片 ' + (idx + 1)) + '</figcaption></figure>'; }).join('') + '</div>';
    }
    detail.innerHTML = '<div class="article-detail__header">' + pinnedBadge + '<h1 class="article-detail__title">' + sanitizeText(article.title) + '</h1></div><div class="article-detail__meta">发布时间 ' + formatTime(article.ts) + '</div>' + galleryHtml + '<div class="article-detail__actions"><button type="button" class="article-like-btn" data-article-like="' + article.id + '">点赞</button><span class="article-like-count">点赞 ' + (article.likes || 0) + '</span><span class="article-comment-count">评论 ' + (Array.isArray(article.comments) ? article.comments.length : 0) + '</span></div>' + manageBar + '<div class="board-post__text board-post__text--rich">' + (article.bodyHtml ? sanitizeHtmlRich(article.bodyHtml) : sanitizeText(article.body).replace(/\n/g, '<br>')) + '</div><section class="content-section article-comments-section"><h2>评论区</h2><div id="articleCommentList"></div><form id="articleCommentForm" class="board-comment-form" autocomplete="off"><textarea name="comment" maxlength="1000" required placeholder="发表评论…"></textarea><button id="articleCommentSubmitBtn" class="btn-primary btn-primary--sm" type="submit">发表评论</button></form><nav class="board-pagination" id="articleCommentPagination" aria-label="评论分页"></nav></section>';
    root.appendChild(detail);

    var editModal = null;
    var editModalStatusTimer = null;
    function closeEditModal() { if (editModal) editModal.hidden = true; }
    function ensureArticleImages() {
      if (!Array.isArray(article.images) || !article.images.length) {
        article.images = article.image ? [article.image] : [];
      }
      if (article.images.length && !article.image) {
        article.image = article.images[0];
      }
    }
    function setEditModalStatus(text, kind) {
      if (!editModal) return;
      var status = editModal.querySelector('.article-edit-modal__status');
      if (!status) return;
      status.textContent = text || '';
      status.setAttribute('data-status-kind', kind || '');
      status.hidden = !text;
      if (editModalStatusTimer) window.clearTimeout(editModalStatusTimer);
      if (text) {
        editModalStatusTimer = window.setTimeout(function () { if (status) status.hidden = true; }, 2800);
      }
    }
    function renderEditImageList(list, images, activeIndex) {
      if (!list) return;
      list.innerHTML = '';
      if (!images.length) {
        list.innerHTML = '<p class="article-edit-images__empty">暂无图片，请先通过图片地址添加封面或补充图片。</p>';
        return;
      }
      images.forEach(function (src, idx) {
        var row = document.createElement('div');
        row.className = 'article-edit-image-item' + (idx === activeIndex ? ' article-edit-image-item--active' : '');
        row.innerHTML = '<img src="' + src + '" alt="文章图片 ' + (idx + 1) + '"><div class="article-edit-image-item__body"><div class="article-edit-image-item__meta"><span>' + (idx === activeIndex ? '封面图' : '图片 ' + (idx + 1)) + '</span><code>' + sanitizeText(src.slice(0, 36)) + (src.length > 36 ? '…' : '') + '</code></div><div class="article-edit-image-item__actions"><button type="button" class="article-manage-btn article-manage-btn--small" data-set-cover-index="' + idx + '">设为封面</button><button type="button" class="article-manage-btn article-manage-btn--small" data-move-image-up="' + idx + '">上移</button><button type="button" class="article-manage-btn article-manage-btn--small" data-move-image-down="' + idx + '">下移</button><button type="button" class="article-manage-btn article-manage-btn--small article-manage-btn--danger" data-remove-image="' + idx + '">删除</button></div></div>';
        list.appendChild(row);
      });
    }
    function openEditModal() {
      if (!canManageArticle) return;
      ensureArticleImages();
      if (!editModal) {
        editModal = document.createElement('div');
        editModal.className = 'article-edit-modal';
        editModal.hidden = true;
        editModal.innerHTML = '<div class="article-edit-modal__overlay" data-close-article-edit-modal="1"></div><div class="article-edit-modal__panel" role="dialog" aria-modal="true" aria-labelledby="articleEditModalTitle"><button type="button" class="article-edit-modal__close" data-close-article-edit-modal="1" aria-label="关闭">×</button><h2 id="articleEditModalTitle">编辑文章</h2><div class="article-edit-modal__status" hidden></div><form id="articleEditForm" class="article-edit-form"><label>标题<input type="text" name="title" maxlength="120" required></label><label>正文<textarea name="body" required></textarea></label><label>封面图地址<input type="text" name="cover" placeholder="填写图片地址"></label><label>文章图片<input type="file" name="uploadImages" accept="image/*" multiple></label><div class="article-edit-images"><div class="article-edit-images__head"><strong>已添加图片</strong><span class="article-edit-images__tip">第一张会作为封面</span></div><div class="article-edit-images__list" id="articleEditImageList"></div></div><div class="article-edit-form__actions"><button type="button" class="article-manage-btn" data-close-article-edit-modal="1">取消</button><button type="submit" class="article-manage-btn article-manage-btn--primary">保存修改</button></div></form></div>';
        document.body.appendChild(editModal);
        editModal.addEventListener('click', function (e) { if (e.target && e.target.hasAttribute('data-close-article-edit-modal')) { closeEditModal(); setEditModalStatus('已取消修改。', 'info'); } });
        document.addEventListener('keydown', function escCloseArticleEdit(e) { if (e.key === 'Escape' && editModal && !editModal.hidden) { closeEditModal(); setEditModalStatus('已取消修改。', 'info'); document.removeEventListener('keydown', escCloseArticleEdit); } });
        var form = editModal.querySelector('#articleEditForm');
        var imageList = editModal.querySelector('#articleEditImageList');
        var imagesState = [];
        var activeCoverIndex = 0;
        function syncStateToForm() {
          var coverInput = form.querySelector('input[name="cover"]');
          var titleInput = form.querySelector('input[name="title"]');
          var bodyInput = form.querySelector('textarea[name="body"]');
          if (titleInput) titleInput.value = article.title || '';
          if (bodyInput) bodyInput.value = article.body || '';
          if (coverInput) coverInput.value = imagesState[0] || '';
          activeCoverIndex = 0;
          renderEditImageList(imageList, imagesState, activeCoverIndex);
        }
        function saveFromModal() {
          var titleInput = form.querySelector('input[name="title"]');
          var bodyInput = form.querySelector('textarea[name="body"]');
          var coverInput = form.querySelector('input[name="cover"]');
          var newTitle = titleInput ? titleInput.value.trim() : '';
          var newBody = bodyInput ? bodyInput.value.trim() : '';
          var cover = coverInput ? coverInput.value.trim() : '';
          if (!newTitle || !newBody) { window.alert('标题和正文不能为空。'); return; }
          if (containsForbiddenContent(newTitle) || containsForbiddenContent(newBody)) { window.alert('内容包含违规信息，已自动阻止保存。'); return; }
          if (cover) {
            if (imagesState.length) imagesState[0] = cover; else imagesState = [cover];
          }
          imagesState = imagesState.filter(function (src) { return String(src || '').trim(); });
          if (!imagesState.length) { setEditModalStatus('保存失败：至少需要一张文章图片。', 'error'); return; }
          var nextImages = imagesState.slice().filter(function (src) { return String(src || '').trim(); });
          var nextArticle = {
            id: article.id,
            title: newTitle,
            image: nextImages[0],
            images: nextImages,
            body: newBody,
            ts: article.ts || Date.now(),
            authorEmail: article.authorEmail || '',
            likes: typeof article.likes === 'number' ? article.likes : 0,
            comments: Array.isArray(article.comments) ? article.comments.slice() : [],
            isPinned: !!article.isPinned,
          };
          try {
            var articleIndex = -1;
            for (var i = 0; i < articles.length; i++) { if (String(articles[i].id) === String(article.id)) { articleIndex = i; break; } }
            if (articleIndex === -1) throw new Error('article missing');
            articles[articleIndex] = nextArticle;
            saveArticles(articles);
            var persisted = getArticles().filter(function (a) { return String(a.id) === String(article.id); })[0];
            if (!persisted || persisted.title !== nextArticle.title || persisted.body !== nextArticle.body || persisted.image !== nextArticle.image || !Array.isArray(persisted.images) || persisted.images.length !== nextImages.length) throw new Error('save verify failed');
            setEditModalStatus('保存成功。', 'success');
            closeEditModal();
            renderArticlePage();
            renderHomeArticles();
            renderHotRankHome();
          } catch (err) {
            setEditModalStatus('保存失败，请稍后重试。', 'error');
            window.alert('保存失败，请稍后重试。');
          }
        }
        form.addEventListener('submit', function (e) { e.preventDefault(); saveFromModal(); });
        var cancelButtons = editModal.querySelectorAll('[data-close-article-edit-modal]');
        Array.prototype.forEach.call(cancelButtons, function (btn) {
          btn.addEventListener('click', function () { closeEditModal(); setEditModalStatus('已取消修改。', 'info'); });
        });
        form.querySelector('input[name="uploadImages"]').addEventListener('change', function (e) {
          Array.prototype.slice.call((e.target && e.target.files) || []).forEach(function (file) {
            var reader = new FileReader();
            reader.onload = function () {
              imagesState.push(String(reader.result || ''));
              renderEditImageList(imageList, imagesState, 0);
              var coverInput = form.querySelector('input[name="cover"]');
              if (coverInput && !coverInput.value.trim()) coverInput.value = imagesState[0] || '';
            };
            reader.readAsDataURL(file);
          });
          e.target.value = '';
        });
        editModal.addEventListener('click', function (e) {
          var setCover = e.target.closest('[data-set-cover-index]');
          var moveUp = e.target.closest('[data-move-image-up]');
          var moveDown = e.target.closest('[data-move-image-down]');
          var remove = e.target.closest('[data-remove-image]');
          if (setCover) {
            var idx = parseInt(setCover.getAttribute('data-set-cover-index') || '0', 10);
            if (!isNaN(idx) && imagesState[idx]) {
              var coverSrc = imagesState.splice(idx, 1)[0];
              imagesState.unshift(coverSrc);
              var coverInput = form.querySelector('input[name="cover"]');
              if (coverInput) coverInput.value = coverSrc;
              renderEditImageList(imageList, imagesState, 0);
            }
          } else if (moveUp) {
            var upIdx = parseInt(moveUp.getAttribute('data-move-image-up') || '0', 10);
            if (upIdx > 0) {
              var tmp = imagesState[upIdx - 1];
              imagesState[upIdx - 1] = imagesState[upIdx];
              imagesState[upIdx] = tmp;
              renderEditImageList(imageList, imagesState, 0);
            }
          } else if (moveDown) {
            var downIdx = parseInt(moveDown.getAttribute('data-move-image-down') || '0', 10);
            if (downIdx >= 0 && downIdx < imagesState.length - 1) {
              var tmp2 = imagesState[downIdx + 1];
              imagesState[downIdx + 1] = imagesState[downIdx];
              imagesState[downIdx] = tmp2;
              renderEditImageList(imageList, imagesState, 0);
            }
          } else if (remove) {
            var removeIdx = parseInt(remove.getAttribute('data-remove-image') || '0', 10);
            if (!isNaN(removeIdx)) {
              imagesState.splice(removeIdx, 1);
              if (!imagesState.length) {
                renderEditImageList(imageList, imagesState, 0);
                return;
              }
              var coverInput2 = form.querySelector('input[name="cover"]');
              if (coverInput2) coverInput2.value = imagesState[0] || '';
              renderEditImageList(imageList, imagesState, 0);
            }
          }
        });
        syncStateToForm();
        editModal._syncStateToForm = syncStateToForm;
        editModal._setImagesState = function (next) { imagesState = next.slice(); syncStateToForm(); };
      }
      var formEl = editModal.querySelector('#articleEditForm');
      var titleEl = formEl.querySelector('input[name="title"]');
      var bodyEl = formEl.querySelector('textarea[name="body"]');
      if (titleEl) titleEl.value = article.title || '';
      if (bodyEl) bodyEl.value = article.body || '';
      if (formEl.querySelector('input[name="cover"]')) formEl.querySelector('input[name="cover"]').value = article.image || (Array.isArray(article.images) && article.images[0]) || '';
      if (editModal._setImagesState) editModal._setImagesState(Array.isArray(article.images) && article.images.length ? article.images.slice() : (article.image ? [article.image] : []));
      editModal.hidden = false;
      if (titleEl) titleEl.focus();
    }

    function getCommentList() { return Array.isArray(article.comments) ? article.comments : (article.comments = []); }
    function saveArticleAndRefresh() { saveArticles(articles); renderArticlePage(); }
    function syncReplyCounts() {
      var comments = getCommentList();
      comments.forEach(function (c) {
        if (!Array.isArray(c.replies)) c.replies = [];
      });
    }
    function renderCommentList() {
      var container = document.getElementById('articleCommentList');
      if (!container) return;
      syncReplyCounts();
      container.innerHTML = '';
      var session = getSessionIdentity();
      var comments = getCommentList().slice().sort(function (a, b) { return (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0) || (b.ts || 0) - (a.ts || 0); });
      var page = parseInt(container.getAttribute('data-current-page') || '1', 10);
      var totalPages = Math.ceil(comments.length / 10) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      container.setAttribute('data-current-page', String(page));
      var pageItems = comments.slice((page - 1) * 10, page * 10);
      if (!comments.length) {
        var empty = document.createElement('p');
        empty.className = 'board-comment-empty';
        empty.textContent = '暂无评论';
        container.appendChild(empty);
      } else {
        pageItems.forEach(function (c) {
          var item = document.createElement('div');
          item.className = 'board-comment';
          var canDelete = session && (isAdminEmail(session.email) || String(c.authorEmail || '') === String(session.email || ''));
          var canPin = session && isAdminEmail(session.email);
          var replies = Array.isArray(c.replies) ? c.replies.slice().sort(function (a, b) { return (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0) || getCommentStats(b).heat - getCommentStats(a).heat || (b.ts || 0) - (a.ts || 0); }).slice(0, 3) : [];
          item.innerHTML = '<div class="board-comment__meta"><span class="board-comment__name">' + sanitizeText(c.nickname || '匿名旅人') + '</span><span class="board-comment__time">' + formatTime(c.ts) + '</span><span class="board-comment__heat">热度 ' + getCommentStats(c).heat + '</span></div><p class="board-comment__text">' + sanitizeText(c.body || '') + '</p><div class="board-comment__actions">' + '<button type="button" class="board-comment__action" data-toggle-reply-form="' + c.id + '">回复</button>' + (canPin ? '<button type="button" class="board-comment__action" data-pin-comment="' + c.id + '">' + (c.isPinned ? '取消置顶' : '置顶') + '</button>' : '') + (canDelete ? '<button type="button" class="board-comment__action board-comment__action--danger" data-delete-comment="' + c.id + '">删除</button>' : '') + '</div><div class="board-reply-list">' + replies.map(function (r) { var canDeleteReply = session && (isAdminEmail(session.email) || String(r.authorEmail || '') === String(session.email || '')); return '<div class="board-reply' + (r.isPinned ? ' board-reply--pinned' : '') + '"><div class="board-reply__meta"><span>' + sanitizeText(r.nickname || '匿名旅人') + '</span><span>' + formatTime(r.ts) + '</span><span>热度 ' + getCommentStats(r).heat + '</span></div><p class="board-reply__text">' + sanitizeText(r.body || '') + '</p><div class="board-comment__actions">' + (canPin ? '<button type="button" class="board-comment__action" data-pin-reply="' + c.id + ':' + r.id + '">' + (r.isPinned ? '取消置顶' : '置顶') + '</button>' : '') + (canDeleteReply ? '<button type="button" class="board-comment__action board-comment__action--danger" data-delete-reply="' + c.id + ':' + r.id + '">删除</button>' : '') + '</div></div>'; }).join('') + '</div><div class="board-reply-form" id="replyForm-' + c.id + '" hidden><textarea maxlength="1000" placeholder="回复这条评论…"></textarea><button type="button" class="btn-primary btn-primary--sm" data-submit-reply="' + c.id + '">发表回复</button></div>';
          container.appendChild(item);
        });
      }
      var pag = document.getElementById('articleCommentPagination');
      if (pag) {
        pag.innerHTML = '';
        pag.hidden = comments.length <= 10;
        if (!pag.hidden) for (var i = 1; i <= totalPages; i++) { var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'board-pagination__btn' + (i === page ? ' board-pagination__btn--current' : ''); btn.textContent = String(i); btn.setAttribute('data-comment-page', String(i)); pag.appendChild(btn); }
      }
    }
    function submitComment(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      var session = getSessionIdentity();
      if (!session) { window.alert('请先登录后再发表评论。'); return; }
      var form = document.getElementById('articleCommentForm');
      var ta = form ? form.querySelector('textarea[name="comment"]') : null;
      var text = ta ? ta.value.trim() : '';
      if (!text) { window.alert('请输入评论内容。'); return; }
      if (isSensitiveText(text)) { window.alert('内容包含违规信息，已自动阻止发布。'); return; }
      getCommentList().push({ id: Date.now(), nickname: session.username, authorEmail: session.email, body: text, ts: Date.now(), likes: 0, replies: [], isPinned: false });
      if (ta) ta.value = '';
      saveArticleAndRefresh();
    }
    function handleCommentActions(e) {
      var deleteBtn = e.target.closest('[data-delete-comment]');
      var pinBtn = e.target.closest('[data-pin-comment]');
      var deleteReplyBtn = e.target.closest('[data-delete-reply]');
      var pinReplyBtn = e.target.closest('[data-pin-reply]');
      var toggleReplyBtn = e.target.closest('[data-toggle-reply-form]');
      var submitReplyBtn = e.target.closest('[data-submit-reply]');
      if (!deleteBtn && !pinBtn && !deleteReplyBtn && !pinReplyBtn && !toggleReplyBtn && !submitReplyBtn) return;
      var session = getSessionIdentity();
      if (!session) return;
      if (toggleReplyBtn) {
        var replyId = String(toggleReplyBtn.getAttribute('data-toggle-reply-form') || '');
        var formNode = document.getElementById('replyForm-' + replyId);
        if (formNode) formNode.hidden = !formNode.hidden;
      } else if (submitReplyBtn) {
        var commentId = String(submitReplyBtn.getAttribute('data-submit-reply') || '');
        var formNode2 = document.getElementById('replyForm-' + commentId);
        var ta = formNode2 ? formNode2.querySelector('textarea') : null;
        var text = ta ? ta.value.trim() : '';
        if (!text) { window.alert('请输入回复内容。'); return; }
        if (isSensitiveText(text)) { window.alert('内容包含违规信息，已自动阻止发布。'); return; }
        var parent = getCommentList().find(function (c) { return String(c.id) === commentId; });
        if (!parent) return;
        if (!Array.isArray(parent.replies)) parent.replies = [];
        parent.replies.push({ id: Date.now(), nickname: session.username, authorEmail: session.email, body: text, ts: Date.now(), likes: 0, isPinned: false });
        saveArticleAndRefresh();
      } else if (deleteBtn) {
        var id = String(deleteBtn.getAttribute('data-delete-comment') || '');
        var list = getCommentList();
        var idx = list.findIndex(function (c) { return String(c.id) === id; });
        if (idx === -1) return;
        if (!isAdminEmail(session.email) && String(list[idx].authorEmail || '') !== String(session.email || '')) return;
        list.splice(idx, 1);
        saveArticleAndRefresh();
      } else if (pinBtn) {
        if (!isAdminEmail(session.email)) return;
        var cid = String(pinBtn.getAttribute('data-pin-comment') || '');
        var list2 = getCommentList();
        var cidx = list2.findIndex(function (c) { return String(c.id) === cid; });
        if (cidx === -1) return;
        list2[cidx].isPinned = !list2[cidx].isPinned;
        saveArticleAndRefresh();
      } else if (deleteReplyBtn) {
        var parts = String(deleteReplyBtn.getAttribute('data-delete-reply') || '').split(':');
        var pc = getCommentList().find(function (c) { return String(c.id) === parts[0]; });
        if (!pc) return;
        var rIdx = (pc.replies || []).findIndex(function (r) { return String(r.id) === parts[1]; });
        if (rIdx === -1) return;
        var reply = pc.replies[rIdx];
        if (!isAdminEmail(session.email) && String(reply.authorEmail || '') !== String(session.email || '')) return;
        pc.replies.splice(rIdx, 1);
        saveArticleAndRefresh();
      } else if (pinReplyBtn) {
        if (!isAdminEmail(session.email)) return;
        var parts2 = String(pinReplyBtn.getAttribute('data-pin-reply') || '').split(':');
        var pc2 = getCommentList().find(function (c) { return String(c.id) === parts2[0]; });
        if (!pc2) return;
        var r2 = (pc2.replies || []).find(function (r) { return String(r.id) === parts2[1]; });
        if (!r2) return;
        r2.isPinned = !r2.isPinned;
        saveArticleAndRefresh();
      }
    }
    renderCommentList();
    var commentForm = document.getElementById('articleCommentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', submitComment);
      var submitButton = document.getElementById('articleCommentSubmitBtn');
      if (submitButton) submitButton.addEventListener('click', submitComment);
    }
    var commentsRoot = document.getElementById('articleCommentList');
    if (commentsRoot) {
      commentsRoot.addEventListener('click', handleCommentActions);
      commentsRoot.addEventListener('submit', function (e) { if (e.target && e.target.matches('.board-reply-form')) { e.preventDefault(); } });
    }
    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', function () { if (history.length > 1) history.back(); else window.location.href = 'index.html'; });
    var likeBtn = root.querySelector('[data-article-like]');
    if (likeBtn) likeBtn.addEventListener('click', function () { article.likes = (article.likes || 0) + 1; saveArticles(articles); likeBtn.classList.remove('like-bounce'); void likeBtn.offsetWidth; likeBtn.classList.add('like-bounce'); setTimeout(function () { likeBtn.classList.remove('like-bounce'); }, 420); renderArticlePage(); });

    var editBtn = document.getElementById('editArticleBtn');
    if (editBtn) editBtn.addEventListener('click', openEditModal);

    var deleteBtn = document.getElementById('deleteArticleBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
      if (!window.confirm('确定要删除这篇文章吗？此操作无法撤销。')) return;
      var filtered = articles.filter(function (a) { return String(a.id) !== String(article.id); });
      saveArticles(filtered);
      window.location.href = 'index.html';
    });

    var pinBtn = document.getElementById('togglePinArticleBtn');
    if (pinBtn) pinBtn.addEventListener('click', function () {
      article.isPinned = !article.isPinned;
      saveArticles(articles);
      renderArticlePage();
      renderHomeArticles();
      renderHotRankHome();
    });

    if (canManageArticle) {
      var editModalFromDom = document.getElementById('articleEditForm');
      if (editModalFromDom) {
        var modalRoot = editModalFromDom.closest('.article-edit-modal');
        if (modalRoot) modalRoot.hidden = true;
      }
    }

  }

  function renderBoard() {
    var view = document.getElementById("boardView");
    if (!view) return;
    var posts = getBoard().posts.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var total = posts.length;
    var page = parseInt(view.getAttribute("data-current-page") || "1", 10);
    var totalPages = total ? Math.ceil(total / BOARD_POSTS_PER_PAGE) : 1;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    view.setAttribute("data-current-page", String(page));
    view.innerHTML = '';
    var pag = document.getElementById('boardPagination');
    if (pag) { pag.innerHTML = ''; pag.hidden = total <= BOARD_POSTS_PER_PAGE; if (!pag.hidden) for (var i = 1; i <= totalPages; i++) { var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'board-pagination__btn' + (i === page ? ' board-pagination__btn--current' : ''); btn.textContent = String(i); btn.setAttribute('data-board-page', String(i)); pag.appendChild(btn); } }
    if (!total) { var empty = document.createElement('p'); empty.className = 'board-empty'; empty.textContent = '暂无留言，登录后来发第一条吧～'; view.appendChild(empty); return; }
    posts.slice((page - 1) * BOARD_POSTS_PER_PAGE, page * BOARD_POSTS_PER_PAGE).forEach(function (p) {
      var thread = document.createElement('article'); thread.className = 'board-thread';
      thread.innerHTML = '<div class="board-post"><div class="board-post__avatar" aria-hidden="true">' + (p.nickname || '匿').charAt(0) + '</div><div class="board-post__body"><div class="board-post__head"><span class="board-post__name">' + sanitizeText(p.nickname || '匿名旅人') + '</span><span class="board-post__time">' + formatTime(p.ts) + '</span></div><button type="button" class="board-post__title-btn" data-open-post="' + p.id + '">' + sanitizeText(p.body || '') + '</button><div class="article-card__meta article-card__meta--bottom"><span>评论 ' + (Array.isArray(p.comments) ? p.comments.length : 0) + '</span></div></div></div>';
      view.appendChild(thread);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    var theme = document.getElementById('themeToggle'); if (theme) theme.addEventListener('click', toggleTheme);
    var searchBtn = document.getElementById('searchIconBtn'); var searchInput = document.getElementById('sidebarSearch'); var searchHistoryWrap = document.getElementById('searchHistoryWrap'); var searchHistoryList = document.getElementById('searchHistoryList'); var clearSearchHistoryBtn = document.getElementById('clearSearchHistoryBtn'); var searchSuggestList = document.getElementById('searchSuggestList'); var searchSuggestPanel = null; var searchHistoryKey = 'tengyou-search-history';
    function getSearchHistory() { try { var raw = localStorage.getItem(searchHistoryKey); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (e) { return []; } }
    function saveSearchHistory(q) { q = String(q || '').trim(); if (!q) return; var arr = getSearchHistory().filter(function (item) { return item !== q; }); arr.unshift(q); arr = arr.slice(0, 10); try { localStorage.setItem(searchHistoryKey, JSON.stringify(arr)); } catch (e) {} }
    function clearSearchHistory() { try { localStorage.removeItem(searchHistoryKey); } catch (e) {} renderSearchHistory(); renderSearchSuggest(); }
    function renderSearchHistory() { if (!searchHistoryList || !searchHistoryWrap) return; var arr = getSearchHistory(); searchHistoryList.innerHTML = ''; searchHistoryWrap.hidden = !arr.length; if (!arr.length) { searchHistoryList.innerHTML = '<p class="search-history__empty">暂无历史搜索</p>'; return; } arr.forEach(function (item) { var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'search-history__item'; btn.innerHTML = '<span class="search-history__text">' + sanitizeText(item) + '</span>'; btn.setAttribute('data-search-history-item', item); searchHistoryList.appendChild(btn); }); }
    function ensureSuggestPanel() { if (searchSuggestPanel) return searchSuggestPanel; if (!searchInput) return null; var wrap = searchInput.parentNode; if (!wrap) return null; wrap.style.position = 'relative'; searchSuggestPanel = document.createElement('div'); searchSuggestPanel.className = 'search-suggest-panel'; searchSuggestPanel.hidden = true; wrap.appendChild(searchSuggestPanel); return searchSuggestPanel; }
    function getSearchMatches(q) { var query = String(q || '').trim().toLowerCase(); if (!query) return []; return getArticles().filter(function (a) { return String(a.title || '').toLowerCase().indexOf(query) !== -1; }).slice(0, 8).map(function (a) { var s = getArticleStats(a); return { id: a.id, title: a.title, image: a.image, heat: s.heat, likes: s.likes, comments: s.comments }; }); }
    function renderSearchSuggest() { if (!searchInput) return; var panel = ensureSuggestPanel(); if (!panel) return; var q = searchInput.value.trim(); var matches = getSearchMatches(q); if (searchSuggestList) searchSuggestList.innerHTML = ''; panel.innerHTML = ''; if (!q || !matches.length) { panel.hidden = true; return; } var suggestSection = document.createElement('div'); suggestSection.className = 'search-suggest-section'; suggestSection.innerHTML = '<p class="search-suggest-section__title">搜索建议</p>'; matches.forEach(function (item) { if (searchSuggestList) { var opt = document.createElement('option'); opt.value = item.title; searchSuggestList.appendChild(opt); } var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'search-suggest-item'; btn.innerHTML = '<img class="search-suggest-item__thumb" src="' + sanitizeText(item.image) + '" alt=""><span class="search-suggest-item__body"><span class="search-suggest-item__title">' + sanitizeText(item.title) + '</span><span class="search-suggest-item__meta">热度 ' + item.heat + ' · 点赞 ' + item.likes + ' · 评论 ' + item.comments + '</span></span>'; btn.addEventListener('click', function () { searchInput.value = item.title; goSearch(); }); suggestSection.appendChild(btn); }); panel.appendChild(suggestSection); panel.hidden = false; }
    if (postBodyInput && postBodyEditor) postBodyInput.value = postBodyEditor.innerHTML.trim();
    if (searchBtn && searchInput) searchBtn.addEventListener('click', function () { searchInput.focus(); });
    function goSearch() {
      if (!searchInput) return;
      var q = searchInput.value.trim();
      if (!q) return;
      saveSearchHistory(q);
      window.location.href = 'search.html?q=' + encodeURIComponent(q);
    }
    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); goSearch(); } });
      searchInput.addEventListener('focus', function () { renderSearchHistory(); renderSearchSuggest(); });
      searchInput.addEventListener('click', function () { renderSearchHistory(); renderSearchSuggest(); });
      searchInput.addEventListener('input', function () { renderSearchSuggest(); });
      searchInput.addEventListener('blur', function () { setTimeout(function () { if (searchSuggestPanel) searchSuggestPanel.hidden = true; }, 150); });
    }
    var searchConfirmBtn = document.getElementById('searchConfirmBtn');
    if (searchConfirmBtn) searchConfirmBtn.addEventListener('click', goSearch);
    if (searchHistoryList) searchHistoryList.addEventListener('click', function (e) { var btn = e.target.closest('[data-search-history-item]'); if (!btn) return; if (searchInput) searchInput.value = btn.getAttribute('data-search-history-item') || ''; goSearch(); });
    if (clearSearchHistoryBtn) clearSearchHistoryBtn.addEventListener('click', clearSearchHistory);
    document.addEventListener('click', function (e) { if (searchSuggestPanel && !searchSuggestPanel.contains(e.target) && e.target !== searchInput) searchSuggestPanel.hidden = true; });

    var registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', function (e) { e.preventDefault(); var u = registerForm.querySelector('input[name="username"]'); var email = registerForm.querySelector('input[name="email"]'); window.TengyouSession.set(u ? u.value.trim() : '', email ? email.value.trim() : ''); window.alert('已注册并登录（浏览器本地演示）。'); });
    var loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', function (e) { e.preventDefault(); var acc = loginForm.querySelector('input[name="account"]'); var emailInput = loginForm.querySelector('input[name="email"]'); var rememberMe = loginForm.querySelector('input[name="rememberMe"]'); var account = acc ? acc.value.trim() : ''; var email = emailInput ? emailInput.value.trim() : ''; var password = loginForm.querySelector('input[name="password"]'); if (!account) return; window.TengyouSession.set(account, email || account); try { if (rememberMe && rememberMe.checked) { localStorage.setItem('tengyou-remember-login', JSON.stringify({ account: account, email: email || account, password: password ? password.value : '' })); } else { localStorage.removeItem('tengyou-remember-login'); } } catch (err) {} window.alert('已登录（浏览器本地演示）。'); });
    if (loginForm) {
      try {
        var remembered = JSON.parse(localStorage.getItem('tengyou-remember-login') || 'null');
        if (remembered) {
          var accEl = loginForm.querySelector('input[name="account"]');
          var passEl = loginForm.querySelector('input[name="password"]');
          var remEl = loginForm.querySelector('input[name="rememberMe"]');
          var historyList = loginForm.querySelector('#loginAccountHistory');
          if (accEl) accEl.value = remembered.account || '';
          if (passEl) passEl.value = remembered.password || '';
          if (remEl) remEl.checked = true;
          if (historyList) {
            historyList.innerHTML = '';
            var arr = JSON.parse(localStorage.getItem('tengyou-login-history') || '[]');
            [remembered.account || ''].concat(Array.isArray(arr) ? arr : []).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).slice(0, 10).forEach(function (item) { var opt = document.createElement('option'); opt.value = item; historyList.appendChild(opt); });
          }
        }
      } catch (err) {}
    }
    if (loginForm) {
      var accountInput = loginForm.querySelector('input[name="account"]');
      if (accountInput) {
        accountInput.addEventListener('focus', function () {
          try {
            var historyList = loginForm.querySelector('#loginAccountHistory');
            if (!historyList) return;
            var arr = JSON.parse(localStorage.getItem('tengyou-login-history') || '[]');
            historyList.innerHTML = '';
            arr.slice(0, 10).forEach(function (item) { var opt = document.createElement('option'); opt.value = item; historyList.appendChild(opt); });
          } catch (err) {}
        });
        accountInput.addEventListener('change', function () {
          try {
            var val = accountInput.value.trim();
            if (!val) return;
            var arr = JSON.parse(localStorage.getItem('tengyou-login-history') || '[]');
            arr = arr.filter(function (x) { return x !== val; });
            arr.unshift(val);
            localStorage.setItem('tengyou-login-history', JSON.stringify(arr.slice(0, 10)));
          } catch (err) {}
        });
      }
    }
    var forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
      var resetState = { code: '' };
      var step1 = document.getElementById('forgotPasswordStep1');
      var step2 = document.getElementById('forgotPasswordStep2');
      var sendBtn = document.getElementById('sendResetCodeBtn');
      var codeStorageKey = 'tengyou-reset-code';
      function showStep2() { if (step1) step1.hidden = true; if (step2) step2.hidden = false; }
      function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
      function sendCode() {
        var emailInput = forgotForm.querySelector('input[name="email"]');
        var email = emailInput ? emailInput.value.trim() : '';
        if (!email) { window.alert('请输入注册邮箱。'); return; }
        resetState.code = genCode();
        try { localStorage.setItem(codeStorageKey, JSON.stringify({ email: email, code: resetState.code, ts: Date.now() })); } catch (err) {}
        window.alert('验证码已发送到 ' + email + '（浏览器本地演示，验证码：' + resetState.code + '）');
        showStep2();
      }
      function resetPassword(e) {
        e.preventDefault();
        var emailInput = forgotForm.querySelector('input[name="email"]');
        var codeInput = forgotForm.querySelector('input[name="code"]');
        var passInput = forgotForm.querySelector('input[name="newPassword"]');
        var pass2Input = forgotForm.querySelector('input[name="newPassword2"]');
        var email = emailInput ? emailInput.value.trim() : '';
        var code = codeInput ? codeInput.value.trim() : '';
        var pw1 = passInput ? passInput.value : '';
        var pw2 = pass2Input ? pass2Input.value : '';
        if (!email || !code || !pw1 || !pw2) { window.alert('请完整填写验证码和新密码。'); return; }
        if (pw1 !== pw2) { window.alert('两次输入的新密码不一致。'); return; }
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(codeStorageKey) || 'null'); } catch (err) {}
        if (!saved || saved.email !== email || saved.code !== code) { window.alert('验证码错误或已过期。'); return; }
        try { localStorage.removeItem(codeStorageKey); } catch (err) {}
        window.alert('密码已重置成功（浏览器本地演示）。');
        window.location.href = 'login.html';
      }
      if (sendBtn) sendBtn.addEventListener('click', sendCode);
      forgotForm.addEventListener('submit', resetPassword);
    }

    renderHomeArticles(); renderHotRankHome();
    var homeList = document.getElementById('homeArticleList'); var homePagination = document.getElementById('homePagination'); var postBtn = document.getElementById('openPostFormBtn'); var postModal = document.getElementById('homePostModal'); var postForm = document.getElementById('homePostForm'); var imageBtn = document.getElementById('addImageBtn'); var imageInput = document.getElementById('homePostImagesInput'); var imageList = document.getElementById('homePostImagesList'); var selectedImages = [];

    var postBodyEditor = document.getElementById('homePostBodyEditor');
    var postBodyInput = document.getElementById('homePostBodyInput');
    var postTextColor = document.getElementById('postTextColor');
    var postTextSize = document.getElementById('postTextSize');
    function syncBodyInput() { if (postBodyInput && postBodyEditor) postBodyInput.value = normalizeEditorHtml(postBodyEditor.innerHTML).trim(); }
    function getSelectionRange() { var sel = window.getSelection && window.getSelection(); if (!sel || !sel.rangeCount || !postBodyEditor || !postBodyEditor.contains(sel.anchorNode)) return null; return sel.getRangeAt(0); }
    function wrapSelection(tagName, attrs) {
      if (!postBodyEditor) return;
      var range = getSelectionRange();
      if (!range || range.collapsed) return;
      var el = document.createElement(tagName);
      if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
      el.appendChild(range.extractContents());
      range.insertNode(el);
      range.selectNodeContents(el);
      var sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      syncBodyInput();
    }
    function applyInlineStyle(styleProp, value) {
      if (!postBodyEditor) return;
      var range = getSelectionRange();
      if (!range || range.collapsed) return;
      var span = document.createElement('span');
      span.style[styleProp] = value;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
      var sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      syncBodyInput();
    }
    function applyBlock(command, value) {
      if (!postBodyEditor) return;
      var range = getSelectionRange();
      if (!range || range.collapsed) return;
      var wrapperTag = 'p';
      if (command === 'formatBlock') wrapperTag = String(value || 'p').toLowerCase();
      if (command === 'blockquote') wrapperTag = 'blockquote';
      var wrapper = document.createElement(wrapperTag);
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
      range.selectNodeContents(wrapper);
      var sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      syncBodyInput();
    }
    function createLinkModern() {
      if (!postBodyEditor) return;
      var range = getSelectionRange();
      if (!range || range.collapsed) return;
      var url = window.prompt('请输入链接地址');
      if (!url) return;
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(range.extractContents());
      range.insertNode(a);
      range.selectNodeContents(a);
      var sel = window.getSelection(); if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      syncBodyInput();
    }
    function normalizeEditorHtml(html) {
      var host = document.createElement('div');
      host.innerHTML = String(html || '');
      host.querySelectorAll('font').forEach(function (node) {
        var span = document.createElement('span');
        if (node.color) span.style.color = node.color;
        if (node.size) span.style.fontSize = node.size;
        span.innerHTML = node.innerHTML;
        node.parentNode.replaceChild(span, node);
      });
      host.querySelectorAll('h1,h2,h3,blockquote,p,div').forEach(function (node) { if (!node.innerHTML.trim()) node.innerHTML = '<br>'; });
      return host.innerHTML;
    }
    function execRichCommand(command, value) {
      if (!postBodyEditor) return;
      postBodyEditor.focus();
      if (command === 'createLink') createLinkModern();
      else if (command === 'formatBlock') applyBlock(command, value);
      else if (command === 'blockquote') applyBlock(command, value);
      else if (command === 'foreColor') applyInlineStyle('color', value || '#000000');
      else if (command === 'fontSize') applyInlineStyle('fontSize', value || '16px');
      else if (command === 'bold' || command === 'italic' || command === 'underline' || command === 'removeFormat' || command === 'insertUnorderedList' || command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') {
        var range = getSelectionRange();
        if (!range || range.collapsed) return;
        if (command === 'removeFormat') {
          var fragment = range.extractContents();
          var temp = document.createElement('div'); temp.appendChild(fragment);
          temp.querySelectorAll('*').forEach(function (n) { n.removeAttribute('style'); n.removeAttribute('class'); n.removeAttribute('target'); n.removeAttribute('rel'); });
          var text = document.createTextNode(temp.textContent || '');
          range.insertNode(text);
        } else if (command === 'insertUnorderedList') {
          applyBlock(command, value);
        } else if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') {
          var div = document.createElement('div');
          div.style.textAlign = command === 'justifyLeft' ? 'left' : command === 'justifyCenter' ? 'center' : 'right';
          div.appendChild(range.extractContents());
          range.insertNode(div);
        } else {
          var tag = command === 'bold' ? 'strong' : command === 'italic' ? 'em' : 'u';
          wrapSelection(tag);
        }
      }
      syncBodyInput();
    }
    function syncImageList() { if (!imageList) return; imageList.innerHTML = ''; selectedImages.forEach(function (src, idx) { var item = document.createElement('div'); item.className = 'home-post-image-item'; item.innerHTML = '<img src="' + src + '" alt="图片 ' + (idx + 1) + '"><div class="home-post-image-item__foot"><p class="home-post-image-item__label">' + (idx === 0 ? '主图' : '图片 ' + (idx + 1)) + '</p><button type="button" class="home-post-image-item__remove" data-remove-home-image="' + idx + '">删除</button></div>'; imageList.appendChild(item); }); }
    function closePostModal() { if (postModal) postModal.hidden = true; }
    function openPostModal() { if (postModal) postModal.hidden = false; }
    if (postBtn && postModal) postBtn.addEventListener('click', function () { var session = window.TengyouSession.get(); if (!session || session.email !== APPROVED_EMAIL) return; openPostModal(); });
    if (postModal) postModal.addEventListener('click', function (e) { if (e.target && e.target.hasAttribute('data-close-post-modal')) closePostModal(); });
    if (postBodyEditor) {
      postBodyEditor.addEventListener('input', syncBodyInput);
      postBodyEditor.addEventListener('blur', syncBodyInput);
      postBodyEditor.addEventListener('paste', function () { setTimeout(function () { postBodyEditor.innerHTML = normalizeEditorHtml(postBodyEditor.innerHTML); syncBodyInput(); }, 0); });
      postBodyEditor.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.shiftKey === false) {
          var sel = window.getSelection && window.getSelection();
          if (!sel || !sel.rangeCount) return;
        }
      });
    }
    if (postTextColor && postBodyEditor) postTextColor.addEventListener('input', function () { execRichCommand('foreColor', postTextColor.value); });
    if (postTextSize && postBodyEditor) postTextSize.addEventListener('change', function () {
      var sizeMap = { '3': '14px', '4': '16px', '5': '20px', '6': '24px' };
      execRichCommand('fontSize', sizeMap[postTextSize.value] || '16px');
    });
    var toolbarBtns = document.querySelectorAll('[data-editor-command]');
    Array.prototype.forEach.call(toolbarBtns, function (btn) { btn.addEventListener('click', function () { if (!postBodyEditor) return; execRichCommand(btn.getAttribute('data-editor-command'), btn.getAttribute('data-editor-value')); }); });
    if (imageBtn && imageInput) { imageBtn.addEventListener('click', function () { var session = window.TengyouSession.get(); if (!session || session.email !== APPROVED_EMAIL) return; imageInput.click(); }); imageInput.addEventListener('change', function () { Array.prototype.slice.call(imageInput.files || []).forEach(function (file) { var reader = new FileReader(); reader.onload = function () { selectedImages.push(String(reader.result || '')); syncImageList(); }; reader.readAsDataURL(file); }); imageInput.value = ''; }); }
    if (imageList) imageList.addEventListener('click', function (e) { var removeBtn = e.target.closest('[data-remove-home-image]'); if (!removeBtn) return; var idx = parseInt(removeBtn.getAttribute('data-remove-home-image') || '0', 10); if (isNaN(idx)) return; selectedImages.splice(idx, 1); syncImageList(); });
    if (postForm) postForm.addEventListener('submit', function (e) { e.preventDefault(); var session = window.TengyouSession.get(); if (!session || session.email !== APPROVED_EMAIL) return; syncBodyInput(); var title = (postForm.querySelector('input[name="title"]') || {}).value || ''; var bodyHtml = (postBodyInput ? postBodyInput.value : '') || ''; title = title.trim(); bodyHtml = normalizeEditorHtml(bodyHtml).trim(); if (!title || !bodyHtml || !selectedImages.length) { window.alert('请填写标题、正文并至少添加一张图片。'); return; } if (containsForbiddenContent(title) || containsForbiddenContent(bodyHtml)) { window.alert('内容包含违规信息，已自动阻止发布。'); return; } var plainText = (postBodyEditor ? postBodyEditor.innerText : bodyHtml).trim(); var articles = getArticles(); articles.push({ id: Date.now(), title: title, image: selectedImages[0], images: selectedImages.slice(), body: plainText, bodyHtml: bodyHtml, ts: Date.now(), authorEmail: session.email, likes: 0, comments: [] }); saveArticles(articles); selectedImages = []; syncImageList(); if (postBodyEditor) postBodyEditor.innerHTML = ''; if (postBodyInput) postBodyInput.value = ''; postForm.reset(); closePostModal(); if (homeList) homeList.setAttribute('data-current-page', '1'); renderHomeArticles(); renderHotRankHome(); });
    if (homePagination) homePagination.addEventListener('click', function (e) { var b = e.target.closest('[data-home-page]'); if (!b) return; if (homeList) homeList.setAttribute('data-current-page', b.getAttribute('data-home-page')); renderHomeArticles(); });
    if (homeList) homeList.addEventListener('click', function (e) {
      var link = e.target.closest('[data-open-article]');
      if (link) { e.preventDefault(); window.location.href = 'article.html?id=' + encodeURIComponent(link.getAttribute('data-open-article')); return; }
      var like = e.target.closest('[data-like-article]');
      if (like) {
        e.preventDefault();
        var articleId = like.getAttribute('data-like-article');
        var articles = getArticles();
        var found = null;
        for (var i = 0; i < articles.length; i++) { if (String(articles[i].id) === String(articleId)) { found = articles[i]; break; } }
        if (!found) return;
        found.likes = (found.likes || 0) + 1;
        saveArticles(articles);
        like.classList.remove('like-bounce');
        void like.offsetWidth;
        like.classList.add('like-bounce');
        setTimeout(function () { like.classList.remove('like-bounce'); }, 420);
        renderHomeArticles();
        renderHotRankHome();
        return;
      }
      var manageBtn = e.target.closest('[data-home-manage]');
      if (!manageBtn) return;
      if (!isApprovedEditor(window.TengyouSession.get())) return;
      e.preventDefault();
      var manageId = manageBtn.getAttribute('data-article-id');
      var manageType = manageBtn.getAttribute('data-home-manage');
      var manageArticles = getArticles();
      var manageArticle = null;
      for (var j = 0; j < manageArticles.length; j++) { if (String(manageArticles[j].id) === String(manageId)) { manageArticle = manageArticles[j]; break; } }
      if (!manageArticle) return;
      if (manageType === 'delete') {
        if (!window.confirm('确定要删除这篇文章吗？此操作无法撤销。')) return;
        saveArticles(manageArticles.filter(function (item) { return String(item.id) !== String(manageId); }));
      } else if (manageType === 'pin') {
        manageArticle.isPinned = !manageArticle.isPinned;
        saveArticles(manageArticles);
      } else if (manageType === 'edit') {
        var editorModal = document.getElementById('homeArticleEditModal');
        if (!editorModal) {
          editorModal = document.createElement('div');
          editorModal.id = 'homeArticleEditModal';
          editorModal.className = 'article-edit-modal';
          editorModal.hidden = true;
          editorModal.innerHTML = '<div class="article-edit-modal__overlay" data-close-home-article-edit-modal="1"></div><div class="article-edit-modal__panel article-edit-modal__panel--home" role="dialog" aria-modal="true" aria-labelledby="homeArticleEditTitle"><button type="button" class="article-edit-modal__close" data-close-home-article-edit-modal="1" aria-label="关闭">×</button><h2 id="homeArticleEditTitle">编辑文章</h2><div class="article-edit-modal__status" hidden></div><form id="homeArticleEditForm" class="home-post-form home-post-form--modal article-edit-form"><label>标题<input type="text" name="title" maxlength="120" placeholder="请输入文章标题" required></label><div class="home-post-images"><button type="button" class="btn-primary btn-primary--ghost" data-add-home-edit-image>添加图片</button><input type="file" name="uploadImages" accept="image/*" multiple hidden><p class="home-post-images__hint">第一张图片会自动作为主图。</p><div class="home-post-images__list" id="homeArticleEditImageList"></div></div><label>文章内容<div class="rich-editor-toolbar" aria-label="富文本编辑工具栏"><p class="rich-editor-toolbar__hint">支持标题、字体、颜色、字号和基础排版</p><button type="button" class="rich-editor-toolbar__btn" data-editor-command="bold"><strong>B</strong></button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="italic"><em>I</em></button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="underline"><u>U</u></button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="insertUnorderedList">• 列表</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="justifyLeft">左对齐</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="justifyCenter">居中</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="justifyRight">右对齐</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="formatBlock" data-editor-value="h1">H1</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="formatBlock" data-editor-value="h2">H2</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="formatBlock" data-editor-value="h3">H3</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="blockquote">引用</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="createLink">插入链接</button><button type="button" class="rich-editor-toolbar__btn" data-editor-command="removeFormat">清除格式</button><label class="rich-editor-toolbar__field">颜色<input type="color" name="textColor" value="#1a1a1a"></label><label class="rich-editor-toolbar__field">字号<select name="textSize"><option value="3">小</option><option value="4" selected>标准</option><option value="5">大</option><option value="6">更大</option></select></label></div><div name="bodyEditor" class="rich-editor" contenteditable="true" data-placeholder="请输入正文，支持换行和简单样式"></div><textarea name="body" hidden required></textarea></label><label>封面图地址<input type="text" name="cover" placeholder="填写图片地址"></label><div class="article-edit-form__actions"><button type="button" class="article-manage-btn" data-close-home-article-edit-modal="1">取消</button><button type="submit" class="article-manage-btn article-manage-btn--primary">保存修改</button></div></form></div>';
          document.body.appendChild(editorModal);
        }
        var editArticles = getArticles();
        var editArticle = null;
        for (var k = 0; k < editArticles.length; k++) { if (String(editArticles[k].id) === String(manageId)) { editArticle = editArticles[k]; break; } }
        if (!editArticle) return;
        var editForm = editorModal.querySelector('#homeArticleEditForm');
        var editStatus = editorModal.querySelector('.article-edit-modal__status');
        var editBodyEditor = editorModal.querySelector('[name="bodyEditor"]');
        var editBodyInput = editorModal.querySelector('textarea[name="body"]');
        var editColor = editorModal.querySelector('input[name="textColor"]');
        var editSize = editorModal.querySelector('select[name="textSize"]');
        var editImageList = editorModal.querySelector('#homeArticleEditImageList');
        var editUploadInput = editorModal.querySelector('input[name="uploadImages"]');
        var editImages = Array.isArray(editArticle.images) && editArticle.images.length ? editArticle.images.slice() : (editArticle.image ? [editArticle.image] : []);
        var editSetStatus = function (text, kind) { if (!editStatus) return; editStatus.textContent = text || ''; editStatus.setAttribute('data-status-kind', kind || ''); editStatus.hidden = !text; };
        function syncEditBody() { if (editBodyInput && editBodyEditor) editBodyInput.value = normalizeEditorHtml(editBodyEditor.innerHTML).trim(); }
        function renderEditHomeImages() { if (!editImageList) return; editImageList.innerHTML = ''; editImages.forEach(function (src, idx) { var item = document.createElement('div'); item.className = 'home-post-image-item'; item.innerHTML = '<img src="' + src + '" alt="图片 ' + (idx + 1) + '"><div class="home-post-image-item__foot"><p class="home-post-image-item__label">' + (idx === 0 ? '主图' : '图片 ' + (idx + 1)) + '</p><button type="button" class="home-post-image-item__remove" data-edit-remove-image="' + idx + '">删除</button></div>'; editImageList.appendChild(item); }); if (!editImages.length) editImageList.innerHTML = '<p class="home-post-images__hint">暂无图片，请点击添加图片。</p>'; }
        function execHomeEditCommand(command, value) { if (!editBodyEditor) return; editBodyEditor.focus(); try { if (command === 'createLink') { var url = window.prompt('请输入链接地址'); if (!url) return; document.execCommand('createLink', false, url); } else if (command === 'formatBlock') { document.execCommand('formatBlock', false, '<' + String(value || 'p') + '>'); } else if (command === 'blockquote') { document.execCommand('formatBlock', false, '<blockquote>'); } else if (command === 'foreColor') { document.execCommand('foreColor', false, value || '#000000'); } else if (command === 'fontSize') { document.execCommand('fontSize', false, value || '4'); } else { document.execCommand(command, false, null); } } catch (err) {} syncEditBody(); }
        function syncEditStateToForm() { if (editForm.querySelector('input[name="title"]')) editForm.querySelector('input[name="title"]').value = editArticle.title || ''; if (editBodyEditor) editBodyEditor.innerHTML = editArticle.bodyHtml || editArticle.body || ''; if (editBodyInput) editBodyInput.value = editArticle.bodyHtml || editArticle.body || ''; if (editForm.querySelector('input[name="cover"]')) editForm.querySelector('input[name="cover"]').value = editImages[0] || editArticle.image || ''; renderEditHomeImages(); }
        syncEditStateToForm();
        editorModal.hidden = false;
        var closeBtns = editorModal.querySelectorAll('[data-close-home-article-edit-modal]');
        Array.prototype.forEach.call(closeBtns, function (btn) { btn.onclick = function () { editorModal.hidden = true; editSetStatus('已取消修改。', 'info'); }; });
        if (editBodyEditor) {
          editBodyEditor.addEventListener('input', syncEditBody);
          editBodyEditor.addEventListener('paste', function () { setTimeout(function () { editBodyEditor.innerHTML = normalizeEditorHtml(editBodyEditor.innerHTML); syncEditBody(); }, 0); });
        }
        if (editorModal) {
          var addHomeEditImageBtn = editorModal.querySelector('[data-add-home-edit-image]');
          if (addHomeEditImageBtn && editUploadInput) addHomeEditImageBtn.addEventListener('click', function () { editUploadInput.click(); });
        }
        if (editColor) editColor.addEventListener('input', function () { execHomeEditCommand('foreColor', editColor.value); });
        if (editSize) editSize.addEventListener('change', function () { var sizeMap = { '3': '14px', '4': '16px', '5': '20px', '6': '24px' }; execHomeEditCommand('fontSize', { '14px': '3', '16px': '4', '20px': '5', '24px': '6' }[sizeMap[editSize.value]] || '4'); });
        Array.prototype.forEach.call(editorModal.querySelectorAll('[data-editor-command]'), function (btn) { btn.onclick = function () { execHomeEditCommand(btn.getAttribute('data-editor-command'), btn.getAttribute('data-editor-value')); }; });
        if (editUploadInput) editUploadInput.onchange = function (e) { Array.prototype.slice.call((e.target && e.target.files) || []).forEach(function (file) { var reader = new FileReader(); reader.onload = function () { editImages.push(String(reader.result || '')); renderEditHomeImages(); syncEditStateToForm(); }; reader.readAsDataURL(file); }); e.target.value = ''; };
        if (editImageList) editImageList.addEventListener('click', function (e) { var rm = e.target.closest('[data-edit-remove-image]'); if (!rm) return; var idx = parseInt(rm.getAttribute('data-edit-remove-image') || '0', 10); if (isNaN(idx)) return; editImages.splice(idx, 1); renderEditHomeImages(); syncEditStateToForm(); });
        var submitHandler = function (evt) {
          evt.preventDefault();
          var newTitle = editForm.querySelector('input[name="title"]').value.trim();
          var newBodyHtml = normalizeEditorHtml((editBodyInput ? editBodyInput.value : (editBodyEditor ? editBodyEditor.innerHTML : '')).trim());
          var newCover = editForm.querySelector('input[name="cover"]').value.trim();
          if (!newTitle || !newBodyHtml || !editImages.length) { editSetStatus('保存失败：标题、正文和图片不能为空。', 'error'); return; }
          if (containsForbiddenContent(newTitle) || containsForbiddenContent(newBodyHtml)) { editSetStatus('保存失败：内容包含违规信息。', 'error'); return; }
          editArticle.title = newTitle;
          editArticle.bodyHtml = newBodyHtml;
          editArticle.body = stripTags(newBodyHtml);
          editArticle.images = editImages.slice();
          editArticle.image = editImages[0] || newCover || editArticle.image || '';
          if (newCover) { editArticle.image = newCover; if (editArticle.images.length) editArticle.images[0] = newCover; else editArticle.images = [newCover]; }
          try {
            saveArticles(editArticles);
            renderHomeArticles();
            renderHotRankHome();
            editSetStatus('保存成功。', 'success');
            editorModal.hidden = true;
          } catch (err) {
            editSetStatus('保存失败，请稍后重试。', 'error');
          }
        };
        editForm.addEventListener('submit', submitHandler);
        return;
      }
      renderHomeArticles();
      renderHotRankHome();
    });

    var articlePage = document.getElementById('articlePage');
    if (articlePage) {
      renderArticlePage();
    }

    var rankingList = document.getElementById('rankingList');
    if (rankingList) {
      renderRankingPage();
      var rankingPag = document.getElementById('rankingPagination');
      if (rankingPag) rankingPag.addEventListener('click', function (e) { var btn = e.target.closest('[data-ranking-page]'); if (!btn) return; rankingList.setAttribute('data-ranking-page', btn.getAttribute('data-ranking-page')); renderRankingPage(); });
    }

    var searchResultList = document.getElementById('searchResultList');
    if (searchResultList) {
      var q = new URLSearchParams(window.location.search).get('q') || '';
      var articles = getArticles().filter(function (a) { return q && String(a.title || '').toLowerCase().indexOf(q.toLowerCase()) !== -1; }).sort(function (a, b) { return getArticleStats(b).heat - getArticleStats(a).heat || (b.ts || 0) - (a.ts || 0); });
      var bc = document.getElementById('searchBreadcrumb');
      updateBreadcrumb(bc, { href: 'index.html', label: '首页' }, { href: 'search.html?q=' + encodeURIComponent(q), label: '搜索：' + q });
      searchResultList.innerHTML = '';
      if (!q) { searchResultList.innerHTML = '<p class="board-empty">请输入标题关键词进行搜索。</p>'; }
      else if (!articles.length) { searchResultList.innerHTML = '<p class="board-empty">未找到匹配文章。</p>'; }
      else {
        articles.forEach(function (a) { var stats = getArticleStats(a); var card = document.createElement('article'); card.className = 'article-card'; card.innerHTML = '<div class="article-card__thumb"><a href="article.html?id=' + encodeURIComponent(a.id) + '"><img src="' + a.image + '" alt="' + sanitizeText(a.title) + '"></a></div><div class="article-card__body"><h2 class="article-card__title"><a href="article.html?id=' + encodeURIComponent(a.id) + '">' + sanitizeText(a.title) + '</a></h2><div class="article-card__meta article-card__meta--bottom"><span>点赞 ' + stats.likes + '</span><span>评论 ' + stats.comments + '</span></div></div>'; searchResultList.appendChild(card); });
      }
    }

    var boardView = document.getElementById('boardView');
    if (boardView) {
      renderBoard();
      var boardPagination = document.getElementById('boardPagination');
      if (boardPagination) boardPagination.addEventListener('click', function (e) { var btn = e.target.closest('[data-board-page]'); if (!btn) return; boardView.setAttribute('data-current-page', btn.getAttribute('data-board-page')); renderBoard(); });
      var boardForm = document.getElementById('boardForm');
      if (boardForm) boardForm.addEventListener('submit', function (e) { e.preventDefault(); var session = window.TengyouSession.get(); if (!session) return; var ta = boardForm.querySelector('textarea[name="content"]'); var body = ta ? ta.value.trim() : ''; if (!body) return; if (containsForbiddenContent(body)) { window.alert('内容包含违规信息，已自动阻止发布。'); return; } var board = getBoard(); board.posts.push({ id: Date.now(), nickname: session.username, body: body, ts: Date.now(), comments: [] }); saveBoard(board); boardForm.reset(); renderBoard(); });
      boardView.addEventListener('click', function (e) { var btn = e.target.closest('[data-open-post]'); if (!btn) return; var id = btn.getAttribute('data-open-post'); var match = getBoard().posts.filter(function (p) { return String(p.id) === String(id); })[0]; if (!match) return; window.location.href = 'find-game.html#post=' + encodeURIComponent(id); });
    }

    var hotMore = document.getElementById('hotRankMoreBtn');
    if (hotMore) hotMore.href = 'ranking.html';
  });
})();
