(function () {
  var STORAGE_KEY = "tengyou-find-game-posts";
  var MAX_POST = 2000;
  var MAX_COMMENT = 1000;
  var POSTS_PER_PAGE = 15;
  var COMMENTS_PER_PAGE = 15;
  var NESTED_COMMENT_LIMIT = 5;
  var currentPage = 1;
  var viewState = { mode: "list", postId: null, commentId: null };
  var expandedNestedComments = {};

  function containsForbiddenContent(text) {
    if (!text || typeof text !== "string") return false;
    var patterns = [
      /(?:https?:\/\/|www\.)/i,
      /[\w.-]+\.(?:com|net|org|cn|cc|top|xyz|gov|edu|io|me|tv|info)(?:[\/?#][^\s]*)?/i,
      /magnet\s*:\s*\?/i,
      /magnet%3a%3f/i,
      /赌博|博彩|下注|代开|彩票/i,
      /色情|裸聊|成人视频|自拍偷拍/i,
      /毒品|吸毒|贩毒|冰毒|海洛因|大麻/i,
      /习近平|中国共产党|反党|推翻政权|台独|港独|疆独/i,
    ];
    var compact = text.replace(/\s+/g, "");
    return patterns.some(function (re) { return re.test(text) || re.test(compact); });
  }

  function normalizeComment(c) {
    return {
      id: c.id != null ? c.id : Date.now() + Math.random(),
      nickname: c.nickname || "匿名旅人",
      body: c.body || "",
      ts: c.ts || 0,
      likes: typeof c.likes === "number" && c.likes > 0 ? c.likes : 0,
      replies: Array.isArray(c.replies) ? c.replies.map(normalizeComment) : [],
      expanded: !!c.expanded,
    };
  }

  function loadBoard() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { posts: [] };
      var data = JSON.parse(raw);
      var list = Array.isArray(data) ? data : data && Array.isArray(data.posts) ? data.posts : [];
      return {
        posts: list.map(function (p) {
          return {
            id: p.id != null ? p.id : Date.now() + Math.random(),
            nickname: p.nickname || "匿名旅人",
            body: p.body || "",
            ts: p.ts || 0,
            comments: Array.isArray(p.comments) ? p.comments.map(normalizeComment) : [],
          };
        }),
      };
    } catch (e) {}
    return { posts: [] };
  }

  function saveBoard(board) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch (e) {}
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function avatarLetter(name) {
    var s = (name || "匿").trim();
    return s.charAt(0) || "匿";
  }

  function getSessionUser() {
    if (!window.TengyouSession || !window.TengyouSession.get) return null;
    var s = window.TengyouSession.get();
    return s ? s.username : null;
  }

  function updateSessionBar() {
    var bar = document.getElementById("boardSessionBar");
    if (!bar) return;
    var user = getSessionUser();
    bar.innerHTML = "";
    if (user) {
      var p = document.createElement("p");
      p.className = "board-session board-session--in";
      p.innerHTML =
        '当前用户：<strong class="board-session__name"></strong> ' +
        '<button type="button" class="board-session__logout">退出</button>';
      p.querySelector(".board-session__name").textContent = user;
      p.querySelector(".board-session__logout").addEventListener("click", function () {
        window.TengyouSession.clear();
        initPage();
      });
      bar.appendChild(p);
    } else {
      var hint = document.createElement("p");
      hint.className = "board-session board-session--out";
      hint.innerHTML =
        '发布留言、回复评论需先 <a href="login.html">登录</a> 或 <a href="register.html">注册</a>（本地演示）。';
      bar.appendChild(hint);
    }
  }

  function updateFormVisibility() {
    var form = document.getElementById("boardForm");
    var guestNote = document.getElementById("boardGuestNote");
    var user = getSessionUser();
    if (form) form.style.display = user ? "block" : "none";
    if (guestNote) guestNote.style.display = user ? "none" : "block";
  }

  function renderPagination(container, totalItems, perPage, page) {
    if (!container) return;
    container.innerHTML = "";
    var totalPages = totalItems ? Math.ceil(totalItems / perPage) : 1;
    if (totalPages <= 1) {
      container.hidden = true;
      return totalPages;
    }
    container.hidden = false;
    for (var i = 1; i <= totalPages; i++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "board-pagination__btn";
      btn.setAttribute("data-page", String(i));
      btn.textContent = String(i);
      if (i === page) {
        btn.classList.add("board-pagination__btn--current");
        btn.setAttribute("aria-current", "page");
      }
      container.appendChild(btn);
    }
    return totalPages;
  }

  function findPost(board, postId) {
    return board.posts.filter(function (p) { return String(p.id) === String(postId); })[0] || null;
  }

  function renderCommentReplies(replyWrap, replies, postId, commentId) {
    var list = document.createElement("div");
    list.className = "board-comment-replies";
    var visible = replies.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var expandedKey = String(postId) + ":" + String(commentId);
    var isExpanded = !!expandedNestedComments[expandedKey];
    var shown = isExpanded ? visible : visible.slice(0, NESTED_COMMENT_LIMIT);

    shown.forEach(function (r) {
      var item = document.createElement("div");
      item.className = "board-comment board-comment--nested";
      var meta = document.createElement("div");
      meta.className = "board-comment__meta";
      var cn = document.createElement("span");
      cn.className = "board-comment__name";
      cn.textContent = r.nickname || "匿名旅人";
      var ct = document.createElement("span");
      ct.className = "board-comment__time";
      ct.textContent = formatTime(r.ts);
      meta.appendChild(cn);
      meta.appendChild(ct);
      var body = document.createElement("p");
      body.className = "board-comment__text";
      body.textContent = r.body || "";
      item.appendChild(meta);
      item.appendChild(body);
      list.appendChild(item);
    });

    if (replies.length > NESTED_COMMENT_LIMIT) {
      var moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "board-comment-more-btn";
      moreBtn.setAttribute("data-expand-replies", expandedKey);
      moreBtn.textContent = isExpanded ? "收起评论" : "更多评论";
      list.appendChild(moreBtn);
    }

    replyWrap.appendChild(list);
  }

  function renderList(board) {
    var root = document.getElementById("boardView");
    if (!root) return;
    root.className = "board-view";
    root.innerHTML = "";

    var posts = board.posts.slice().sort(function (a, b) { return (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0) || (b.ts || 0) - (a.ts || 0); });
    var total = posts.length;
    var totalPages = renderPagination(document.getElementById("boardPagination"), total, POSTS_PER_PAGE, currentPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    if (!total) {
      var empty = document.createElement("p");
      empty.className = "board-empty";
      empty.textContent = "暂无留言，登录后来发第一条吧～";
      root.appendChild(empty);
      return;
    }

    var start = (currentPage - 1) * POSTS_PER_PAGE;
    var pagePosts = posts.slice(start, start + POSTS_PER_PAGE);
    var user = getSessionUser();

    pagePosts.forEach(function (p) {
      var thread = document.createElement("article");
      thread.className = "board-thread";
      thread.setAttribute("data-post-id", String(p.id));

      var row = document.createElement("div");
      row.className = "board-post";

      var av = document.createElement("div");
      av.className = "board-post__avatar";
      av.setAttribute("aria-hidden", "true");
      av.textContent = avatarLetter(p.nickname);

      var body = document.createElement("div");
      body.className = "board-post__body";

      var head = document.createElement("div");
      head.className = "board-post__head";

      var nameEl = document.createElement("span");
      nameEl.className = "board-post__name";
      nameEl.textContent = p.nickname || "匿名旅人";

      var timeEl = document.createElement("span");
      timeEl.className = "board-post__time";
      timeEl.textContent = formatTime(p.ts);

      head.appendChild(nameEl);
      head.appendChild(timeEl);

      var titleBtn = null;
      if (user) {
        titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "board-post__title-btn";
        titleBtn.textContent = p.body || "";
        titleBtn.setAttribute("data-open-post", String(p.id));
        body.appendChild(head);
        body.appendChild(titleBtn);
      } else {
        var text = document.createElement("p");
        text.className = "board-post__text";
        text.textContent = p.body || "";
        body.appendChild(head);
        body.appendChild(text);
      }

      row.appendChild(av);
      row.appendChild(body);
      thread.appendChild(row);

      var commentsWrap = document.createElement("div");
      commentsWrap.className = "board-comments";
      var subTitle = document.createElement("h3");
      subTitle.className = "board-comments__title";
      subTitle.textContent = "评论";
      commentsWrap.appendChild(subTitle);
      var admin = window.TengyouSession && window.TengyouSession.get && String((window.TengyouSession.get().email || '')).toLowerCase() === '871412257@qq.com';
      var postActions = document.createElement('div');
      postActions.className = 'board-post__actions';
      postActions.style.display = (admin || String(p.nickname || '') === String(user || '')) ? 'flex' : 'none';
      if (admin) {
        var pinPostBtn = document.createElement('button');
        pinPostBtn.type = 'button';
        pinPostBtn.className = 'board-post__action-btn';
        pinPostBtn.setAttribute('data-pin-post', String(p.id));
        pinPostBtn.textContent = p.isPinned ? '取消置顶' : '置顶';
        postActions.appendChild(pinPostBtn);
      }
      if (admin || String(p.nickname || '') === String(user || '')) {
        var delPostBtn = document.createElement('button');
        delPostBtn.type = 'button';
        delPostBtn.className = 'board-post__action-btn board-post__action-btn--danger';
        delPostBtn.setAttribute('data-delete-post', String(p.id));
        delPostBtn.textContent = '删除';
        postActions.appendChild(delPostBtn);
      }
      commentsWrap.appendChild(postActions);

      var cList = document.createElement("div");
      cList.className = "board-comment-list";
      var comments = Array.isArray(p.comments) ? p.comments.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }) : [];

      if (!comments.length) {
        var noC = document.createElement("p");
        noC.className = "board-comment-empty";
        noC.textContent = "还没有评论";
        cList.appendChild(noC);
      } else {
        comments.slice(0, 3).forEach(function (c) {
          var item = document.createElement("div");
          item.className = "board-comment";
          var meta = document.createElement("div");
          meta.className = "board-comment__meta";
          var cn = document.createElement("span");
          cn.className = "board-comment__name";
          cn.textContent = c.nickname || "匿名旅人";
          var ct = document.createElement("span");
          ct.className = "board-comment__time";
          ct.textContent = formatTime(c.ts);
          meta.appendChild(cn);
          meta.appendChild(ct);
          var bodyText = document.createElement("p");
          bodyText.className = "board-comment__text";
          bodyText.textContent = c.body || "";
          item.appendChild(meta);
          item.appendChild(bodyText);
          cList.appendChild(item);
        });
        if (comments.length > 3) {
          var moreTip = document.createElement("p");
          moreTip.className = "board-comment-more";
          moreTip.textContent = "还有更多评论，请点进此留言查看。";
          cList.appendChild(moreTip);
        }
      }

      commentsWrap.appendChild(cList);

      if (user) {
        var cForm = document.createElement("form");
        cForm.className = "board-comment-form";
        cForm.setAttribute("data-post-id", String(p.id));

        var ta = document.createElement("textarea");
        ta.name = "comment";
        ta.setAttribute("maxlength", String(MAX_COMMENT));
        ta.setAttribute("required", "");
        ta.setAttribute("placeholder", "写下评论…（禁止任何网址）");
        ta.rows = 3;

        var cHint = document.createElement("p");
        cHint.className = "board-form__hint";
        cHint.textContent = "禁止发布任何网址，违者将无法发送。";

        var btn = document.createElement("button");
        btn.type = "submit";
        btn.className = "btn-primary btn-primary--sm";
        btn.textContent = "发表评论";

        cForm.appendChild(ta);
        cForm.appendChild(cHint);
        cForm.appendChild(btn);
        commentsWrap.appendChild(cForm);
      } else {
        var loginPrompt = document.createElement("p");
        loginPrompt.className = "board-comment-login-hint";
        loginPrompt.innerHTML = '<a href="login.html">登录</a> 后可回复该留言';
        commentsWrap.appendChild(loginPrompt);
      }

      thread.appendChild(commentsWrap);
      root.appendChild(thread);
    });
  }

  function renderDetail(board, postId) {
    var root = document.getElementById("boardView");
    if (!root) return;
    root.className = "board-view";
    root.innerHTML = "";

    var post = findPost(board, postId);
    if (!post) {
      var empty = document.createElement("p");
      empty.className = "board-empty";
      empty.textContent = "留言不存在或已失效。";
      root.appendChild(empty);
      return;
    }

    var detail = document.createElement("article");
    detail.className = "board-thread board-comment-detail";

    var row = document.createElement("div");
    row.className = "board-post";
    var av = document.createElement("div");
    av.className = "board-post__avatar";
    av.setAttribute("aria-hidden", "true");
    av.textContent = avatarLetter(post.nickname);
    var body = document.createElement("div");
    body.className = "board-post__body";
    var head = document.createElement("div");
    head.className = "board-post__head";
    var nameEl = document.createElement("span");
    nameEl.className = "board-post__name";
    nameEl.textContent = post.nickname || "匿名旅人";
    var timeEl = document.createElement("span");
    timeEl.className = "board-post__time";
    timeEl.textContent = formatTime(post.ts);
    head.appendChild(nameEl);
    head.appendChild(timeEl);
    var text = document.createElement("p");
    text.className = "board-post__text";
    text.textContent = post.body || "";
    body.appendChild(head);
    body.appendChild(text);
    row.appendChild(av);
    row.appendChild(body);
    detail.appendChild(row);

    var admin = window.TengyouSession && window.TengyouSession.get && String((window.TengyouSession.get().email || '')).toLowerCase() === '871412257@qq.com';
    if (admin || String(post.nickname || '') === String(getSessionUser() || '')) {
      var postActions = document.createElement('div');
      postActions.className = 'board-post__actions';
      if (admin) {
        var pinPostBtn = document.createElement('button');
        pinPostBtn.type = 'button';
        pinPostBtn.className = 'board-post__action-btn';
        pinPostBtn.setAttribute('data-pin-post', String(post.id));
        pinPostBtn.textContent = post.isPinned ? '取消置顶' : '置顶';
        postActions.appendChild(pinPostBtn);
      }
      var delPostBtn = document.createElement('button');
      delPostBtn.type = 'button';
      delPostBtn.className = 'board-post__action-btn board-post__action-btn--danger';
      delPostBtn.setAttribute('data-delete-post', String(post.id));
      delPostBtn.textContent = '删除';
      postActions.appendChild(delPostBtn);
      detail.appendChild(postActions);
    }

    var comments = Array.isArray(post.comments) ? post.comments.slice().sort(function (a, b) { return (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0) || (b.ts || 0) - (a.ts || 0); }) : [];
    var commentTotalPages = renderPagination(document.getElementById("boardPagination"), comments.length, COMMENTS_PER_PAGE, currentPage);
    if (currentPage > commentTotalPages) currentPage = commentTotalPages;
    if (currentPage < 1) currentPage = 1;
    var start = (currentPage - 1) * COMMENTS_PER_PAGE;
    var pageComments = comments.slice(start, start + COMMENTS_PER_PAGE);

    var commentsWrap = document.createElement("div");
    commentsWrap.className = "board-comments";
    var subTitle = document.createElement("h3");
    subTitle.className = "board-comments__title";
    subTitle.textContent = "评论";
    commentsWrap.appendChild(subTitle);
    var session = window.TengyouSession && window.TengyouSession.get ? window.TengyouSession.get() : null;
    var admin = session && String(session.email || '').toLowerCase() === '871412257@qq.com';
    var postActions = document.createElement('div');
    postActions.className = 'board-post__actions';
    postActions.style.display = (admin || String(post.nickname || '') === String(session && session.username || '')) ? 'flex' : 'none';
    if (admin) {
      var pinPostBtn = document.createElement('button');
      pinPostBtn.type = 'button';
      pinPostBtn.className = 'board-post__action-btn';
      pinPostBtn.setAttribute('data-pin-post', String(post.id));
      pinPostBtn.textContent = post.isPinned ? '取消置顶' : '置顶';
      postActions.appendChild(pinPostBtn);
    }
    if (admin || String(post.nickname || '') === String(session && session.username || '')) {
      var delPostBtn = document.createElement('button');
      delPostBtn.type = 'button';
      delPostBtn.className = 'board-post__action-btn board-post__action-btn--danger';
      delPostBtn.setAttribute('data-delete-post', String(post.id));
      delPostBtn.textContent = '删除';
      postActions.appendChild(delPostBtn);
    }
    commentsWrap.appendChild(postActions);

    var cList = document.createElement("div");
    cList.className = "board-comment-list";
    if (!comments.length) {
      var noC = document.createElement("p");
      noC.className = "board-comment-empty";
      noC.textContent = "还没有评论";
      cList.appendChild(noC);
    } else {
      pageComments.forEach(function (c) {
        var item = document.createElement("div");
        item.className = "board-comment";
        var meta = document.createElement("div");
        meta.className = "board-comment__meta";
        var cn = document.createElement("span");
        cn.className = "board-comment__name";
        cn.textContent = c.nickname || "匿名旅人";
        var ct = document.createElement("span");
        ct.className = "board-comment__time";
        ct.textContent = formatTime(c.ts);
        var likeEl = document.createElement("span");
        likeEl.className = "board-comment__likes";
        likeEl.textContent = "点赞 " + (c.likes || 0);
        meta.appendChild(cn);
        meta.appendChild(ct);
        meta.appendChild(likeEl);
        var bodyText = document.createElement("p");
        bodyText.className = "board-comment__text";
        bodyText.textContent = c.body || "";
        item.appendChild(meta);
        item.appendChild(bodyText);

        if (user) {
          var replyToggle = document.createElement("button");
          replyToggle.type = "button";
          replyToggle.className = "board-comment-more-btn";
          replyToggle.setAttribute("data-toggle-reply-form", String(post.id) + ":" + String(c.id));
          replyToggle.textContent = "回复";
          item.appendChild(replyToggle);

          var replyForm = document.createElement("form");
          replyForm.className = "board-comment-form board-comment-form--reply";
          replyForm.hidden = true;
          replyForm.setAttribute("data-reply-post-id", String(post.id));
          replyForm.setAttribute("data-reply-comment-id", String(c.id));
          var replyTa = document.createElement("textarea");
          replyTa.name = "reply";
          replyTa.setAttribute("maxlength", String(MAX_COMMENT));
          replyTa.setAttribute("required", "");
          replyTa.setAttribute("placeholder", "回复这条评论…");
          replyTa.rows = 2;
          var replyBtn = document.createElement("button");
          replyBtn.type = "submit";
          replyBtn.className = "btn-primary btn-primary--sm";
          replyBtn.textContent = "发送回复";
          replyForm.appendChild(replyTa);
          replyForm.appendChild(replyBtn);
          item.appendChild(replyForm);
        }

        if (Array.isArray(c.replies) && c.replies.length) {
          var replyWrap = document.createElement("div");
          replyWrap.className = "board-comment-replies-wrap";
          renderCommentReplies(replyWrap, c.replies, post.id, c.id);
          item.appendChild(replyWrap);
        }

        cList.appendChild(item);
      });
    }

    commentsWrap.appendChild(cList);

    var user = getSessionUser();
    if (user) {
      var cForm = document.createElement("form");
      cForm.className = "board-comment-form";
      cForm.setAttribute("data-post-id", String(post.id));
      var ta = document.createElement("textarea");
      ta.name = "comment";
      ta.setAttribute("maxlength", String(MAX_COMMENT));
      ta.setAttribute("required", "");
      ta.setAttribute("placeholder", "写下评论…（禁止磁力链接）");
      ta.rows = 3;
      var cHint = document.createElement("p");
      cHint.className = "board-form__hint";
      cHint.textContent = "禁止发布 magnet:? 等磁力链接，违者将无法发送。";
      var btn = document.createElement("button");
      btn.type = "submit";
      btn.className = "btn-primary btn-primary--sm";
      btn.textContent = "发表评论";
      cForm.appendChild(ta);
      cForm.appendChild(cHint);
      cForm.appendChild(btn);
      commentsWrap.appendChild(cForm);
    } else {
      var loginPrompt = document.createElement("p");
      loginPrompt.className = "board-comment-login-hint";
      loginPrompt.innerHTML = '<a href="login.html">登录</a> 后可回复该留言';
      commentsWrap.appendChild(loginPrompt);
    }

    detail.appendChild(commentsWrap);
    root.appendChild(detail);
  }

  function initPage() {
    updateSessionBar();
    updateFormVisibility();
    var board = loadBoard();
    if (viewState.mode === "detail" && viewState.postId != null) {
      renderDetail(board, viewState.postId);
    } else {
      renderList(board);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPage();

    var form = document.getElementById("boardForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var user = getSessionUser();
        if (!user) {
          return;
        }
        var bodyInput = form.querySelector('textarea[name="content"]');
        var body = bodyInput ? bodyInput.value.trim() : "";
        if (!body) {
          return;
        }
        if (body.length > MAX_POST) {
          window.alert("内容请控制在 " + MAX_POST + " 字以内。");
          return;
        }
        if (containsForbiddenContent(body)) {
          window.alert("内容包含违规信息，已自动阻止发布。");
          return;
        }
        var board = loadBoard();
        board.posts.push({ id: Date.now(), nickname: user, body: body, ts: Date.now(), comments: [] });
        saveBoard(board);
        currentPage = 1;
        renderList(board);
        form.reset();
      });
    }

    var pagNav = document.getElementById("boardPagination");
    if (pagNav) {
      pagNav.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-page]");
        if (!btn || btn.disabled) return;
        var p = parseInt(btn.getAttribute("data-page"), 10);
        if (isNaN(p) || p === currentPage) return;
        currentPage = p;
        initPage();
        try {
          document.getElementById("boardView").scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {}
      });
    }

    var view = document.getElementById("boardView");
    if (view) {
      view.addEventListener("click", function (e) {
        var openBtn = e.target.closest("[data-open-post]");
        if (openBtn) {
          var user = getSessionUser();
          if (!user) {
            window.alert("请先登录后再进入留言详情。");
            return;
          }
          viewState.mode = "detail";
          viewState.postId = openBtn.getAttribute("data-open-post");
          currentPage = 1;
          initPage();
          return;
        }

        var backBtn = e.target.closest("[data-back-list]");
        if (backBtn) {
          viewState.mode = "list";
          viewState.postId = null;
          currentPage = 1;
          initPage();
          return;
        }

        var expandBtn = e.target.closest("[data-expand-replies]");
        if (expandBtn) {
          var key = expandBtn.getAttribute("data-expand-replies");
          expandedNestedComments[key] = !expandedNestedComments[key];
          initPage();
        }
      });
    }

    if (view) {
      view.addEventListener("submit", function (e) {
        var cForm = e.target;
        if (!cForm || !cForm.classList || !cForm.classList.contains("board-comment-form")) return;
        e.preventDefault();
        var user = getSessionUser();
        if (!user) {
          return;
        }

        var board = loadBoard();
        var postId = cForm.getAttribute("data-post-id");
        var post = findPost(board, postId);
        if (!post) {
          return;
        }

        var replyPostId = cForm.getAttribute("data-reply-post-id");
        if (replyPostId) {
          var parentCommentId = cForm.getAttribute("data-reply-comment-id");
          var replyTa = cForm.querySelector('textarea[name="reply"]');
          var replyText = replyTa ? replyTa.value.trim() : "";
          if (!replyText) {
            return;
          }
          if (replyText.length > MAX_COMMENT) {
            window.alert("回复请控制在 " + MAX_COMMENT + " 字以内。");
            return;
          }
          if (containsForbiddenContent(replyText)) {
            window.alert("内容包含违规信息，已自动阻止发布。");
            return;
          }
          var parentComment = null;
          (post.comments || []).forEach(function walk(comment) {
            if (String(comment.id) === String(parentCommentId)) parentComment = comment;
            if (!parentComment && Array.isArray(comment.replies)) comment.replies.forEach(walk);
          });
          if (!parentComment) {
            window.alert("评论不存在或已失效。");
            return;
          }
          if (!Array.isArray(parentComment.replies)) parentComment.replies = [];
          parentComment.replies.push({ id: Date.now(), nickname: user, body: replyText, ts: Date.now(), likes: 0, replies: [] });
          saveBoard(board);
          currentPage = 1;
          cForm.reset();
          initPage();
          return;
        }

        var ta = cForm.querySelector('textarea[name="comment"]');
        var text = ta ? ta.value.trim() : "";
        if (!text) {
          window.alert("请填写评论内容。");
          return;
        }
        if (text.length > MAX_COMMENT) {
          window.alert("评论请控制在 " + MAX_COMMENT + " 字以内。");
          return;
        }
        if (containsForbiddenContent(text)) {
          window.alert("内容包含违规信息，已自动阻止发布。");
          return;
        }
        if (!Array.isArray(post.comments)) post.comments = [];
        post.comments.push({ id: Date.now(), nickname: user, body: text, ts: Date.now(), likes: 0, replies: [] });
        saveBoard(board);
        currentPage = 1;
        cForm.reset();
        initPage();
      });

      view.addEventListener("click", function (e) {
        var toggle = e.target.closest("[data-toggle-reply-form]");
        if (toggle) {
          var key = toggle.getAttribute("data-toggle-reply-form");
          var parts = key.split(":");
          var form = view.querySelector('[data-reply-post-id="' + parts[0] + '"][data-reply-comment-id="' + parts[1] + '"]');
          if (form) form.hidden = !form.hidden;
          return;
        }
        var delPost = e.target.closest("[data-delete-post]");
        var pinPost = e.target.closest("[data-pin-post]");
        if (!delPost && !pinPost) return;
        var session = window.TengyouSession && window.TengyouSession.get ? window.TengyouSession.get() : null;
        if (!session) return;
        var admin = String(session.email || "").toLowerCase() === "871412257@qq.com";
        var board = loadBoard();
        var pid = String((delPost || pinPost).getAttribute(delPost ? "data-delete-post" : "data-pin-post") || "");
        var post = findPost(board, pid);
        if (!post) return;
        if (delPost) {
          if (!admin && String(post.nickname || "") !== String(session.username || "")) return;
          board.posts = board.posts.filter(function (p) { return String(p.id) !== pid; });
          saveBoard(board);
          initPage();
        } else if (pinPost) {
          if (!admin) return;
          post.isPinned = !post.isPinned;
          saveBoard(board);
          initPage();
        }
      });
    }
  });
})();
