(() => {
  'use strict';

  const STORAGE_KEY = 'suno-patrol-data-v1';
  const app = document.querySelector('#app');
  const artistDialog = document.querySelector('#artist-dialog');
  const songDialog = document.querySelector('#song-dialog');
  const importDialog = document.querySelector('#import-dialog');
  let state = loadState();
  let toastTimer;

  function uid(prefix) {
    return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  }
  function now() { return new Date().toISOString(); }
  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function safeUrl(value) {
    try { const url = new URL(String(value).trim()); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  function cleanTags(value) {
    return Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : String(value || '').split(/[,、\n]/).map(v => v.trim()).filter(Boolean);
  }
  function defaultState() {
    const createdAt = now();
    return {
      artists: [], songs: [], categories: [
        { id: uid('cat'), name: '毎日見る', sortOrder: 0 },
        { id: uid('cat'), name: '作曲研究', sortOrder: 1 },
        { id: uid('cat'), name: '好き', sortOrder: 2 }
      ], settings: { sortMode: 'manual', lastRoute: 'home' }, createdAt
    };
  }
  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const categories = Array.isArray(raw.categories) ? raw.categories.filter(c => c && c.name).map((c, i) => ({ id: String(c.id || uid('cat')), name: String(c.name).trim(), sortOrder: Number.isFinite(c.sortOrder) ? c.sortOrder : i })) : base.categories;
    const artists = Array.isArray(raw.artists) ? raw.artists.filter(a => a && a.name).map((a, i) => ({
      id: String(a.id || uid('artist')), name: String(a.name).trim(), handle: String(a.handle || ''), profileUrl: String(a.profileUrl || ''), iconUrl: String(a.iconUrl || ''), categoryIds: Array.isArray(a.categoryIds) ? a.categoryIds.map(String) : [], favorite: Boolean(a.favorite), memo: String(a.memo || ''), tags: cleanTags(a.tags), sortOrder: Number.isFinite(a.sortOrder) ? a.sortOrder : i, createdAt: a.createdAt || now(), lastOpenedAt: a.lastOpenedAt || ''
    })) : [];
    const artistIds = new Set(artists.map(a => a.id));
    const songs = Array.isArray(raw.songs) ? raw.songs.filter(s => s && s.title && artistIds.has(String(s.artistId))).map(s => ({
      id: String(s.id || uid('song')), artistId: String(s.artistId), title: String(s.title).trim(), sunoUrl: String(s.sunoUrl || ''), memo: String(s.memo || ''), tags: cleanTags(s.tags), createdAt: s.createdAt || now()
    })) : [];
    return { artists, songs, categories, settings: { ...base.settings, ...(raw.settings || {}) } };
  }
  function loadState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return defaultState(); }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function notify(message) {
    const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function parseRoute() {
    const cleanHash = location.hash.replace(/^#\/?/, '');
    const [path] = cleanHash.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'home', id: parts[1] || '' };
  }
  function setActiveNav(route) {
    document.querySelectorAll('[data-route-link]').forEach(link => link.classList.toggle('active', link.dataset.routeLink === route));
  }
  function navigate(path) { location.hash = `#/${path}`; }
  function avatar(artist, large = false) {
    const initials = artist.name.trim().slice(0, 1).toUpperCase() || '?';
    return `<span class="artist-avatar${large ? ' large' : ''}">${safeUrl(artist.iconUrl) ? `<img src="${esc(safeUrl(artist.iconUrl))}" alt="">` : esc(initials)}</span>`;
  }
  function categoryName(id) { return state.categories.find(c => c.id === id)?.name || ''; }
  function chipsFor(artist) {
    return [...(artist.categoryIds || []).map(categoryName).filter(Boolean), ...(artist.tags || [])].slice(0, 4).map((tag, i) => `<span class="chip${i === 0 ? ' accent' : ''}">${esc(tag)}</span>`).join('');
  }
  function artistCard(artist, controls = false) {
    return `<a class="artist-card card" href="#/artist/${encodeURIComponent(artist.id)}" data-artist-link="${esc(artist.id)}">
      ${avatar(artist)}<span class="artist-summary"><span class="artist-name-line"><span class="artist-name">${esc(artist.name)}</span>${artist.favorite ? '<span class="faint" aria-label="お気に入り">★</span>' : ''}</span>
      ${artist.handle ? `<span class="artist-handle">${esc(artist.handle)}</span>` : '<span class="artist-handle">Suno artist</span>'}<span class="artist-meta">${chipsFor(artist)}</span></span>
      ${controls ? `<span class="sort-controls" onclick="event.preventDefault();event.stopPropagation()"><button type="button" data-move="up" data-id="${esc(artist.id)}" aria-label="${esc(artist.name)}を上へ">↑</button><button type="button" data-move="down" data-id="${esc(artist.id)}" aria-label="${esc(artist.name)}を下へ">↓</button></span>` : ''}<svg class="card-arrow"><use href="#icon-arrow"></use></svg></a>`;
  }
  function pageShell(content, route) { setActiveNav(route); app.innerHTML = `<div class="page">${content}</div>`; app.focus({ preventScroll: true }); }
  function renderHome() {
    const favorites = state.artists.filter(a => a.favorite).sort((a,b) => a.sortOrder - b.sortOrder).slice(0, 5);
    const recent = [...state.artists].filter(a => a.lastOpenedAt).sort((a,b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt)).slice(0, 5);
    const catCounts = state.categories.map(c => ({ ...c, count: state.artists.filter(a => a.categoryIds.includes(c.id)).length })).filter(c => c.count);
    pageShell(`<header class="hero"><p class="eyebrow">Personal巡回ランチャー</p><h1>Suno <span>Patrol</span></h1><p class="hero-copy">本当に見たいアーティストだけを、いつでもすぐに。</p><div class="hero-actions"><a class="btn btn-primary" href="#/artists"><svg><use href="#icon-users"></use></svg>アーティストを見る</a><button class="btn btn-ghost" type="button" data-action="add-artist"><svg><use href="#icon-plus"></use></svg>追加</button></div></header>
      <section class="section"><div class="section-title"><h2>お気に入り</h2><a href="#/favorites">すべて見る</a></div>${favorites.length ? `<div class="artist-list">${favorites.map(a => artistCard(a)).join('')}</div>` : emptyState('star', 'お気に入りを作る', '気になるアーティストに★を付けると、ここから巡回できます。', 'アーティストを探す', '#/artists')}</section>
      ${recent.length ? `<section class="section"><div class="section-title"><h2>最近開いたアーティスト</h2></div><div class="artist-list">${recent.map(a => artistCard(a)).join('')}</div></section>` : ''}
      ${catCounts.length ? `<section class="section"><div class="section-title"><h2>カテゴリから探す</h2></div><div class="tag-row">${catCounts.map(c => `<a class="chip" href="#/artists?category=${encodeURIComponent(c.id)}">${esc(c.name)} · ${c.count}</a>`).join('')}</div></section>` : ''}`, 'home');
  }
  function emptyState(icon, title, text, action, href) { return `<div class="empty-state card"><div class="empty-icon"><svg><use href="#icon-${icon === 'star' ? 'star' : 'users'}"></use></svg></div><h2>${esc(title)}</h2><p>${esc(text)}</p>${action ? `<a class="btn btn-primary" href="${href}">${esc(action)}</a>` : ''}</div>`; }
  function renderArtists(favoriteOnly = false) {
    const query = new URLSearchParams(location.hash.split('?')[1] || '').get('category') || '';
    const currentSearch = window._artistSearch || '';
    let artists = state.artists.filter(a => !favoriteOnly || a.favorite).filter(a => !query || a.categoryIds.includes(query));
    if (currentSearch) { const q = currentSearch.toLowerCase(); artists = artists.filter(a => [a.name, a.handle, a.memo, ...(a.tags || [])].join(' ').toLowerCase().includes(q)); }
    const sort = state.settings.sortMode || 'manual';
    artists.sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name, 'ja') : sort === 'recent' ? new Date(b.lastOpenedAt || 0) - new Date(a.lastOpenedAt || 0) : sort === 'created' ? new Date(a.createdAt) - new Date(b.createdAt) : a.sortOrder - b.sortOrder);
    const title = favoriteOnly ? 'Favorites' : 'Artists';
    pageShell(`<header class="page-header"><div><p class="eyebrow">${favoriteOnly ? '★' : 'Library'}</p><h1>${title}</h1><p class="subtitle">${artists.length}人の登録アーティスト</p></div><button class="btn btn-primary btn-small" type="button" data-action="add-artist"><svg><use href="#icon-plus"></use></svg>追加</button></header>
      <div class="toolbar"><label class="search-box"><svg><use href="#icon-search"></use></svg><input id="artist-search" type="search" placeholder="名前、handle、メモ、タグを検索" value="${esc(currentSearch)}" autocomplete="off" aria-label="アーティストを検索"></label><div class="toolbar-row"><div class="select-wrap"><select id="sort-select" aria-label="並び替え"><option value="manual" ${sort === 'manual' ? 'selected' : ''}>手動順</option><option value="name" ${sort === 'name' ? 'selected' : ''}>名前順</option><option value="recent" ${sort === 'recent' ? 'selected' : ''}>最近開いた順</option><option value="created" ${sort === 'created' ? 'selected' : ''}>登録順</option></select></div>${query ? `<a class="btn btn-ghost btn-small" href="#/artists">カテゴリ: ${esc(categoryName(query))} ×</a>` : ''}</div></div>
      ${artists.length ? `<div class="artist-list">${artists.map(a => artistCard(a, !favoriteOnly && sort === 'manual')).join('')}</div>` : emptyState(favoriteOnly ? 'star' : 'users', currentSearch || query ? '見つかりませんでした' : favoriteOnly ? 'お気に入りはまだありません' : '最初のアーティストを登録', currentSearch || query ? '検索条件やカテゴリを変えて試してください。' : favoriteOnly ? 'Artistsから★を付けて、お気に入りの巡回リストを作りましょう。' : 'SunoプロフィールURLがあれば、すぐに登録できます。', favoriteOnly || currentSearch || query ? 'Artistsへ移動' : 'アーティストを追加', favoriteOnly || currentSearch || query ? '#/artists' : '#add')}`, favoriteOnly ? 'favorites' : 'artists');
    const search = document.querySelector('#artist-search'); if (search) search.addEventListener('input', e => { window._artistSearch = e.target.value; renderArtists(favoriteOnly); requestAnimationFrame(() => { const s = document.querySelector('#artist-search'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }); });
    document.querySelector('#sort-select')?.addEventListener('change', e => { state.settings.sortMode = e.target.value; save(); renderArtists(favoriteOnly); });
  }
  function renderArtistDetail(id) {
    const artist = state.artists.find(a => a.id === id); if (!artist) return navigate('artists');
    artist.lastOpenedAt = now(); save();
    const songs = state.songs.filter(s => s.artistId === artist.id).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    pageShell(`<div class="detail-header"><button class="icon-btn" type="button" data-back aria-label="戻る"><svg><use href="#icon-back"></use></svg></button><span class="spacer"></span><button class="icon-btn star${artist.favorite ? ' active' : ''}" type="button" data-action="toggle-favorite" data-id="${esc(artist.id)}" aria-label="お気に入り${artist.favorite ? 'を外す' : 'に追加'}"><svg><use href="#icon-star"></use></svg></button><button class="icon-btn" type="button" data-action="edit-artist" data-id="${esc(artist.id)}" aria-label="アーティストを編集"><svg><use href="#icon-edit"></use></svg></button><button class="icon-btn" type="button" data-action="delete-artist" data-id="${esc(artist.id)}" aria-label="アーティストを削除"><svg><use href="#icon-trash"></use></svg></button></div>
      <section class="profile-hero">${avatar(artist, true)}<h1>${esc(artist.name)}</h1>${artist.handle ? `<p class="artist-handle">${esc(artist.handle)}</p>` : ''}${safeUrl(artist.profileUrl) ? `<a class="btn btn-primary" href="${esc(safeUrl(artist.profileUrl))}" target="_blank" rel="noopener noreferrer"><svg><use href="#icon-external"></use></svg>Sunoプロフィールを開く</a>` : ''}</section>
      ${artist.categoryIds.length || artist.tags.length ? `<section class="detail-block"><p class="detail-label">カテゴリ / タグ</p><div class="tag-row">${chipsFor(artist)}</div></section>` : ''}${artist.memo ? `<section class="detail-block"><p class="detail-label">メモ</p><div class="memo-box card">${esc(artist.memo)}</div></section>` : ''}
      <section class="detail-block"><div class="section-title"><h2>登録した曲 <span class="faint">${songs.length}</span></h2><button class="btn btn-primary btn-small" type="button" data-action="add-song" data-artist-id="${esc(artist.id)}"><svg><use href="#icon-plus"></use></svg>曲を追加</button></div>${songs.length ? `<div class="song-list">${songs.map(song => songRow(song)).join('')}</div>` : `<div class="notice">曲URLを登録すると、ここからいつでも再生・参照できます。</div>`}</section>`, 'artists');
  }
  function songRow(song) { return `<a class="song-row card" href="#/song/${encodeURIComponent(song.id)}"><span class="song-play"><svg><use href="#icon-play"></use></svg></span><span class="song-info"><span class="song-title">${esc(song.title)}</span>${song.memo ? `<span class="song-memo">${esc(song.memo)}</span>` : '<span class="song-memo">Suno song</span>'}</span><svg class="card-arrow"><use href="#icon-arrow"></use></svg></a>`; }
  function extractSunoId(url) {
    try { const u = new URL(url); if (!/(^|\.)suno\.com$/i.test(u.hostname)) return ''; const match = u.pathname.match(/(?:song|embed)\/([a-zA-Z0-9_-]+)/i); return match ? match[1] : ''; } catch { return ''; }
  }
  function renderSongDetail(id) {
    const song = state.songs.find(s => s.id === id); if (!song) return navigate('artists');
    const artist = state.artists.find(a => a.id === song.artistId); if (!artist) return navigate('artists');
    artist.lastOpenedAt = now(); save();
    const embedId = extractSunoId(song.sunoUrl);
    pageShell(`<div class="detail-header"><button class="icon-btn" type="button" data-back aria-label="戻る"><svg><use href="#icon-back"></use></svg></button><span class="spacer"></span><button class="icon-btn" type="button" data-action="edit-song" data-id="${esc(song.id)}" aria-label="曲を編集"><svg><use href="#icon-edit"></use></svg></button><button class="icon-btn" type="button" data-action="delete-song" data-id="${esc(song.id)}" aria-label="曲を削除"><svg><use href="#icon-trash"></use></svg></button></div><p class="eyebrow">Song Detail</p><h1>${esc(song.title)}</h1><p class="subtitle">${esc(artist.name)}${artist.handle ? ` · ${esc(artist.handle)}` : ''}</p>
      <section class="detail-block"><div class="player-card card"><div class="player-frame">${embedId ? `<iframe src="https://suno.com/embed/${encodeURIComponent(embedId)}" title="${esc(song.title)} のSunoプレイヤー" loading="lazy" allow="autoplay; encrypted-media"></iframe>` : `<div class="player-placeholder"><div><svg><use href="#icon-music"></use></svg><p>このURL形式は埋め込み再生に対応していません。<br>下のボタンからSunoで開けます。</p></div></div>`}</div>${embedId ? '<div class="player-note">Sunoの公式埋め込みプレイヤーを使用しています。</div>' : ''}</div></section>
      <section class="detail-block"><a class="btn btn-primary" href="${esc(safeUrl(song.sunoUrl) || '#')}" ${safeUrl(song.sunoUrl) ? 'target="_blank" rel="noopener noreferrer"' : ''}><svg><use href="#icon-external"></use></svg>Sunoで曲を開く</a></section>${song.memo ? `<section class="detail-block"><p class="detail-label">メモ</p><div class="memo-box card">${esc(song.memo)}</div></section>` : ''}${song.tags.length ? `<section class="detail-block"><p class="detail-label">タグ</p><div class="tag-row">${song.tags.map(t => `<span class="chip">#${esc(t.replace(/^#/, ''))}</span>`).join('')}</div></section>` : ''}`, 'artists');
  }
  function renderSettings() {
    pageShell(`<header class="page-header"><div><p class="eyebrow">Preferences</p><h1>Settings</h1><p class="subtitle">この端末のSuno Patrolを管理</p></div></header><div class="settings-list"><section class="settings-card card"><h2>データ</h2><p>アーティスト、曲、カテゴリをJSONファイルとして保存・復元できます。</p><div class="settings-actions"><button class="btn btn-primary btn-small" data-action="export"><svg><use href="#icon-download"></use></svg>バックアップを書き出す</button><button class="btn btn-ghost btn-small" data-action="open-import"><svg><use href="#icon-upload"></use></svg>バックアップを読み込む</button></div></section><section class="settings-card card"><h2>カテゴリ</h2><p>アーティストを整理するカテゴリを自由に追加できます。</p><ul class="category-list">${state.categories.sort((a,b) => a.sortOrder - b.sortOrder).map(c => `<li class="category-item"><span>${esc(c.name)}</span><button type="button" data-action="delete-category" data-id="${esc(c.id)}" aria-label="${esc(c.name)}を削除">×</button></li>`).join('') || '<li class="faint">カテゴリはありません</li>'}</ul><form class="inline-form" id="category-form"><input name="name" placeholder="例：Electronic" aria-label="新しいカテゴリ名" maxlength="30" required><button class="btn btn-ghost btn-small" type="submit">追加</button></form></section><section class="settings-card card"><h2>Suno Patrolについて</h2><p>このアプリはSunoを使う人向けの、個人用ブックマーク管理・巡回ランチャーです。アカウント情報の取得やSunoの自動巡回は行いません。</p><div class="notice"><strong>オフライン対応：</strong>登録した情報はこのブラウザ内に保存され、ネット接続なしでも閲覧できます。</div></section></div>`, 'settings');
    document.querySelector('#category-form')?.addEventListener('submit', e => { e.preventDefault(); const name = new FormData(e.target).get('name').trim(); if (!name) return; if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return notify('同じカテゴリがすでにあります'); state.categories.push({ id: uid('cat'), name, sortOrder: state.categories.length }); save(); renderSettings(); notify('カテゴリを追加しました'); });
  }
  function openArtistForm(id = '') {
    const artist = state.artists.find(a => a.id === id) || { name: '', handle: '', profileUrl: '', iconUrl: '', categoryIds: [], memo: '', tags: [] };
    artistDialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><h2 id="artist-dialog-title">${id ? 'アーティストを編集' : 'アーティストを追加'}</h2><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><form id="artist-form" class="form-grid"><div class="field"><label for="artist-name">名前</label><input id="artist-name" name="name" value="${esc(artist.name)}" maxlength="80" required autofocus></div><div class="field"><label for="profile-url">SunoプロフィールURL</label><input id="profile-url" name="profileUrl" type="url" placeholder="https://suno.com/@..." value="${esc(artist.profileUrl)}" required></div><div class="field"><label for="handle">Suno handle <span class="optional">任意</span></label><input id="handle" name="handle" placeholder="@username" value="${esc(artist.handle)}" maxlength="80"></div><div class="field"><label for="icon-url">アイコンURL <span class="optional">任意</span></label><input id="icon-url" name="iconUrl" type="url" placeholder="https://..." value="${esc(artist.iconUrl)}"></div><div class="field"><label>カテゴリ <span class="optional">複数選択可</span></label><div class="checkbox-grid">${state.categories.map(c => `<label class="check-chip"><input type="checkbox" name="categoryIds" value="${esc(c.id)}" ${artist.categoryIds.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('') || '<p class="no-category-note">カテゴリはSettingsから追加できます。</p>'}</div></div><div class="field"><label for="artist-memo">メモ <span class="optional">任意</span></label><textarea id="artist-memo" name="memo" maxlength="1000" placeholder="このアーティストを見たい理由など">${esc(artist.memo)}</textarea></div><div class="field"><label for="artist-tags">タグ <span class="optional">任意・カンマ区切り</span></label><input id="artist-tags" name="tags" value="${esc(artist.tags.join(', '))}" placeholder="electropop, reference"></div><div class="form-actions"><button class="btn btn-ghost" type="button" data-close-dialog>キャンセル</button><button class="btn btn-primary" type="submit">${id ? '保存' : '追加'}</button></div></form></div>`;
    artistDialog.showModal();
    artistDialog.querySelector('#artist-form').addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.target); const name = fd.get('name').trim(); const profileUrl = safeUrl(fd.get('profileUrl')); if (!name || !profileUrl) return notify('名前と正しいURLを入力してください'); const record = { name, profileUrl, handle: fd.get('handle').trim(), iconUrl: safeUrl(fd.get('iconUrl')) || '', categoryIds: fd.getAll('categoryIds'), memo: fd.get('memo').trim(), tags: cleanTags(fd.get('tags')) }; if (id) Object.assign(artist, record); else state.artists.push({ id: uid('artist'), ...record, favorite: false, sortOrder: state.artists.length, createdAt: now(), lastOpenedAt: '' }); save(); artistDialog.close(); notify(id ? 'アーティストを保存しました' : 'アーティストを追加しました'); render(); });
  }
  function openSongForm(artistId, id = '') {
    const song = state.songs.find(s => s.id === id) || { title: '', sunoUrl: '', memo: '', tags: [] }; const artist = state.artists.find(a => a.id === (artistId || song.artistId));
    if (!artist) return;
    songDialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><h2 id="song-dialog-title">${id ? '曲を編集' : '曲を追加'}</h2><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><form id="song-form" class="form-grid"><div class="field"><label for="song-title">曲名</label><input id="song-title" name="title" value="${esc(song.title)}" maxlength="120" required autofocus></div><div class="field"><label for="song-url">Suno曲URL</label><input id="song-url" name="sunoUrl" type="url" placeholder="https://suno.com/song/..." value="${esc(song.sunoUrl)}" required><p class="no-category-note">Suno以外のURLも登録できますが、埋め込みはSuno曲URLのみです。</p></div><div class="field"><label for="song-memo">メモ <span class="optional">任意</span></label><textarea id="song-memo" name="memo" maxlength="1000" placeholder="参考にしたいポイントなど">${esc(song.memo)}</textarea></div><div class="field"><label for="song-tags">タグ <span class="optional">任意・カンマ区切り</span></label><input id="song-tags" name="tags" value="${esc(song.tags.join(', '))}" placeholder="cute, reference"></div><div class="form-actions"><button class="btn btn-ghost" type="button" data-close-dialog>キャンセル</button><button class="btn btn-primary" type="submit">${id ? '保存' : '追加'}</button></div></form></div>`;
    songDialog.showModal();
    songDialog.querySelector('#song-form').addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(e.target); const title = fd.get('title').trim(); const sunoUrl = safeUrl(fd.get('sunoUrl')); if (!title || !sunoUrl) return notify('曲名と正しいURLを入力してください'); const record = { title, sunoUrl, memo: fd.get('memo').trim(), tags: cleanTags(fd.get('tags')) }; if (id) Object.assign(song, record); else state.songs.push({ id: uid('song'), artistId: artist.id, ...record, createdAt: now() }); save(); songDialog.close(); notify(id ? '曲を保存しました' : '曲を追加しました'); render(); });
  }
  function exportData() { const blob = new Blob([JSON.stringify({ ...state, exportedAt: now(), app: 'Suno Patrol' }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `suno-patrol-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500); notify('バックアップを書き出しました'); }
  function openImport() { importDialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><h2 id="import-dialog-title">バックアップを読み込む</h2><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><p class="muted">JSONバックアップを読み込みます。現在のデータは置き換えられます。</p><div class="field"><label for="backup-file">JSONファイル</label><input id="backup-file" type="file" accept="application/json,.json"></div><div class="form-actions"><button class="btn btn-ghost" type="button" data-close-dialog>キャンセル</button><button class="btn btn-primary" type="button" data-action="import-file">読み込む</button></div></div>`; importDialog.showModal(); }
  async function importFile() { const file = importDialog.querySelector('#backup-file')?.files?.[0]; if (!file) return notify('JSONファイルを選択してください'); try { const text = await file.text(); const parsed = JSON.parse(text); if (!Array.isArray(parsed.artists) || !Array.isArray(parsed.songs) || !Array.isArray(parsed.categories)) throw new Error(); state = normalizeState(parsed); save(); importDialog.close(); render(); notify('バックアップを読み込みました'); } catch { notify('読み込めるバックアップではありません'); } }
  function moveArtist(id, direction) { const list = [...state.artists].sort((a,b) => a.sortOrder - b.sortOrder); const i = list.findIndex(a => a.id === id); const next = i + direction; if (i < 0 || next < 0 || next >= list.length) return; [list[i], list[next]] = [list[next], list[i]]; list.forEach((a, index) => a.sortOrder = index); save(); render(); }
  function render() { const route = parseRoute(); if (route.name === 'artists') renderArtists(); else if (route.name === 'favorites') renderArtists(true); else if (route.name === 'artist') renderArtistDetail(decodeURIComponent(route.id)); else if (route.name === 'song') renderSongDetail(decodeURIComponent(route.id)); else if (route.name === 'settings') renderSettings(); else renderHome(); }
  document.addEventListener('click', e => { const action = e.target.closest('[data-action]')?.dataset.action; if (action === 'add-artist') openArtistForm(); if (action === 'toggle-favorite') { const id = e.target.closest('[data-action]').dataset.id; const artist = state.artists.find(a => a.id === id); if (artist) { artist.favorite = !artist.favorite; save(); render(); notify(artist.favorite ? 'お気に入りに追加しました' : 'お気に入りから外しました'); } } if (action === 'edit-artist') openArtistForm(e.target.closest('[data-action]').dataset.id); if (action === 'delete-artist') { const id = e.target.closest('[data-action]').dataset.id; if (confirm('このアーティストと登録曲を削除しますか？')) { state.artists = state.artists.filter(a => a.id !== id); state.songs = state.songs.filter(s => s.artistId !== id); save(); navigate('artists'); notify('削除しました'); } } if (action === 'add-song') openSongForm(e.target.closest('[data-action]').dataset.artistId); if (action === 'edit-song') { const id = e.target.closest('[data-action]').dataset.id; openSongForm(state.songs.find(s => s.id === id)?.artistId, id); } if (action === 'delete-song') { const id = e.target.closest('[data-action]').dataset.id; if (confirm('この曲を削除しますか？')) { const artistId = state.songs.find(s => s.id === id)?.artistId; state.songs = state.songs.filter(s => s.id !== id); save(); navigate(`artist/${encodeURIComponent(artistId)}`); notify('曲を削除しました'); } } if (action === 'export') exportData(); if (action === 'open-import') openImport(); if (action === 'import-file') importFile(); if (action === 'delete-category') { const id = e.target.closest('[data-action]').dataset.id; if (confirm('このカテゴリを削除しますか？所属アーティストからも外れます。')) { state.categories = state.categories.filter(c => c.id !== id); state.artists.forEach(a => a.categoryIds = a.categoryIds.filter(cid => cid !== id)); save(); renderSettings(); notify('カテゴリを削除しました'); } } if (e.target.closest('[data-move]')) { const b = e.target.closest('[data-move]'); moveArtist(b.dataset.id, b.dataset.move === 'up' ? -1 : 1); } if (e.target.closest('[data-back]')) history.length > 1 ? history.back() : navigate('artists'); if (e.target.closest('[data-close-dialog]')) e.target.closest('dialog')?.close(); });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }));
  window.addEventListener('hashchange', render); window.addEventListener('DOMContentLoaded', () => { if (!location.hash) navigate('home'); else render(); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
