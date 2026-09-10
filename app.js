(() => {
  'use strict';

  const STORAGE_KEY = 'suno-patrol-data-v2';
  const LEGACY_KEY = 'suno-patrol-data-v1';
  const app = document.querySelector('#app');
  const importDialog = document.querySelector('#import-dialog');
  let state;
  let toastTimer;

  const uid = prefix => `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  const now = () => new Date().toISOString();
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const safeUrl = value => { try { const url = new URL(String(value).trim()); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; } };
  const cleanTags = value => Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : String(value || '').split(/[,、\n]/).map(v => v.trim()).filter(Boolean);
  const params = () => {
    const result = new URLSearchParams(location.search);
    const hashQuery = location.hash.split('?')[1];
    if (hashQuery) new URLSearchParams(hashQuery).forEach((value, key) => result.set(key, value));
    return result;
  };
  state = loadState();
  function sharedLink() {
    const candidate = params().get('url') || params().get('text') || '';
    return safeUrl(candidate) || safeUrl(candidate.match(/https?:\/\/\S+/)?.[0] || '');
  }

  function defaultState() {
    return { artists: [], categories: [
      { id: uid('cat'), name: '毎日見る', sortOrder: 0 },
      { id: uid('cat'), name: '作曲研究', sortOrder: 1 },
      { id: uid('cat'), name: '好き', sortOrder: 2 }
    ], settings: { sortMode: 'manual' } };
  }
  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const categories = Array.isArray(raw.categories) ? raw.categories.filter(c => c && c.name).map((c, i) => ({ id: String(c.id || uid('cat')), name: String(c.name).trim(), sortOrder: Number.isFinite(c.sortOrder) ? c.sortOrder : i })) : base.categories;
    const artists = Array.isArray(raw.artists) ? raw.artists.filter(a => a && (a.name || a.profileUrl)).map((a, i) => ({
      id: String(a.id || uid('artist')), name: String(a.name || '').trim(), handle: String(a.handle || ''), profileUrl: String(a.profileUrl || ''), iconUrl: String(a.iconUrl || ''), categoryIds: Array.isArray(a.categoryIds) ? a.categoryIds.map(String) : [], favorite: Boolean(a.favorite), memo: String(a.memo || ''), tags: cleanTags(a.tags), sortOrder: Number.isFinite(a.sortOrder) ? a.sortOrder : i, createdAt: a.createdAt || now(), lastOpenedAt: a.lastOpenedAt || ''
    })) : [];
    return { artists, categories, settings: { ...base.settings, ...(raw.settings || {}) } };
  }
  function loadState() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeState(JSON.parse(current));
      const legacy = localStorage.getItem(LEGACY_KEY);
      return legacy ? normalizeState(JSON.parse(legacy)) : defaultState();
    } catch { return defaultState(); }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function notify(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600); }
  function route() {
    const cleanHash = location.hash.replace(/^#\/?/, '');
    const [path] = cleanHash.split('?');
    const parts = path.split('/').filter(Boolean);
    const sharedUrl = sharedLink();
    if (!parts.length && sharedUrl) return { name: 'quick-add', id: '' };
    return { name: parts[0] || 'home', id: parts[1] || '' };
  }
  function navigate(path) { location.hash = `#/${path}`; }
  function setActiveNav(name) { document.querySelectorAll('[data-route-link]').forEach(link => link.classList.toggle('active', link.dataset.routeLink === name)); }
  function pageShell(content, nav = 'home') { setActiveNav(nav); app.innerHTML = `<div class="page">${content}</div>`; app.focus({ preventScroll: true }); }
  function categoryName(id) { return state.categories.find(c => c.id === id)?.name || ''; }
  function deriveName(url, title = '') {
    if (title.trim()) return title.trim();
    try { const parsed = new URL(url); const handle = parsed.pathname.match(/(?:@|profile\/)([^/]+)/i)?.[1]; return handle ? `@${decodeURIComponent(handle)}` : '未整理のアーティスト'; } catch { return '未整理のアーティスト'; }
  }
  function avatar(artist, large = false) {
    const initials = artist.name.trim().replace(/^@/, '').slice(0, 1).toUpperCase() || '?';
    return `<span class="artist-avatar${large ? ' large' : ''}">${safeUrl(artist.iconUrl) ? `<img src="${esc(safeUrl(artist.iconUrl))}" alt="">` : esc(initials)}</span>`;
  }
  function chipsFor(artist) {
    return [...(artist.categoryIds || []).map(categoryName).filter(Boolean), ...(artist.tags || [])].slice(0, 4).map((tag, i) => `<span class="chip${i === 0 ? ' accent' : ''}">${esc(tag)}</span>`).join('');
  }
  function artistCard(artist, controls = false) {
    const profile = safeUrl(artist.profileUrl);
    return `<div class="artist-card card"><a class="artist-main" href="${esc(profile || `#/artist/${encodeURIComponent(artist.id)}`)}" ${profile ? 'target="_blank" rel="noopener noreferrer" data-external-link' : ''} aria-label="${esc(artist.name)}をSunoで開く">${avatar(artist)}<span class="artist-summary"><span class="artist-name-line"><span class="artist-name">${esc(artist.name)}</span>${artist.favorite ? '<span class="faint" aria-label="お気に入り">★</span>' : ''}</span>${artist.handle ? `<span class="artist-handle">${esc(artist.handle)}</span>` : '<span class="artist-handle">Suno artist</span>'}<span class="artist-meta">${chipsFor(artist)}</span></span><svg class="card-arrow"><use href="#icon-external"></use></svg></a><a class="icon-btn artist-manage" href="#/artist/${encodeURIComponent(artist.id)}" aria-label="${esc(artist.name)}を管理"><svg><use href="#icon-edit"></use></svg></a>${controls ? `<span class="sort-controls"><button type="button" data-move="up" data-id="${esc(artist.id)}" aria-label="${esc(artist.name)}を上へ">↑</button><button type="button" data-move="down" data-id="${esc(artist.id)}" aria-label="${esc(artist.name)}を下へ">↓</button></span>` : ''}</div>`;
  }
  function emptyState(icon, title, text, action, href) { return `<div class="empty-state card"><div class="empty-icon"><svg><use href="#icon-${icon === 'star' ? 'star' : 'users'}"></use></svg></div><h2>${esc(title)}</h2><p>${esc(text)}</p>${action ? `<a class="btn btn-primary" href="${href}">${esc(action)}</a>` : ''}</div>`; }

  function renderHome() {
    const favorites = state.artists.filter(a => a.favorite).sort((a,b) => a.sortOrder - b.sortOrder).slice(0, 5);
    const recent = [...state.artists].filter(a => a.lastOpenedAt).sort((a,b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt)).slice(0, 5);
    pageShell(`<header class="hero"><p class="eyebrow">Personal artist index</p><h1>Suno <span>Patrol</span></h1><p class="hero-copy">Sunoで見つけたアーティストを覚えておいて、次にすぐ開く。</p><div class="hero-actions"><a class="btn btn-primary" href="#/artists"><svg><use href="#icon-users"></use></svg>アーティストを見る</a><a class="btn btn-ghost" href="#/quick-add"><svg><use href="#icon-plus"></use></svg>URLを登録</a></div></header><section class="section"><div class="section-title"><h2>お気に入り</h2><a href="#/favorites">すべて見る</a></div>${favorites.length ? `<div class="artist-list">${favorites.map(a => artistCard(a)).join('')}</div>` : emptyState('star', 'お気に入りを作る', '気になるアーティストに★を付けると、ここからすぐ開けます。', 'アーティストを登録', '#/quick-add')}</section>${recent.length ? `<section class="section"><div class="section-title"><h2>最近開いたアーティスト</h2></div><div class="artist-list">${recent.map(a => artistCard(a)).join('')}</div></section>` : ''}`, 'home');
  }
  function renderArtists(favoriteOnly = false) {
    const queryParams = params(); const category = queryParams.get('category') || ''; const searchValue = window._artistSearch || '';
    let artists = state.artists.filter(a => !favoriteOnly || a.favorite).filter(a => !category || a.categoryIds.includes(category));
    if (searchValue) { const q = searchValue.toLowerCase(); artists = artists.filter(a => [a.name, a.handle, a.memo, ...(a.tags || [])].join(' ').toLowerCase().includes(q)); }
    const sort = state.settings.sortMode || 'manual';
    artists.sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name, 'ja') : sort === 'recent' ? new Date(b.lastOpenedAt || 0) - new Date(a.lastOpenedAt || 0) : sort === 'created' ? new Date(a.createdAt) - new Date(b.createdAt) : a.sortOrder - b.sortOrder);
    pageShell(`<header class="page-header"><div><p class="eyebrow">${favoriteOnly ? '★' : 'Library'}</p><h1>${favoriteOnly ? 'Favorites' : 'Artists'}</h1><p class="subtitle">${artists.length}人の登録アーティスト</p></div><a class="btn btn-primary btn-small" href="#/quick-add"><svg><use href="#icon-plus"></use></svg>URLを登録</a></header><div class="toolbar"><label class="search-box"><svg><use href="#icon-search"></use></svg><input id="artist-search" type="search" placeholder="名前、handle、メモ、タグを検索" value="${esc(searchValue)}" autocomplete="off" aria-label="アーティストを検索"></label><div class="toolbar-row"><div class="select-wrap"><select id="sort-select" aria-label="並び替え"><option value="manual" ${sort === 'manual' ? 'selected' : ''}>手動順</option><option value="name" ${sort === 'name' ? 'selected' : ''}>名前順</option><option value="recent" ${sort === 'recent' ? 'selected' : ''}>最近開いた順</option><option value="created" ${sort === 'created' ? 'selected' : ''}>登録順</option></select></div>${category ? `<a class="btn btn-ghost btn-small" href="#/artists">カテゴリ: ${esc(categoryName(category))} ×</a>` : ''}</div></div>${artists.length ? `<div class="artist-list">${artists.map(a => artistCard(a, !favoriteOnly && sort === 'manual')).join('')}</div>` : emptyState(favoriteOnly ? 'star' : 'users', searchValue || category ? '見つかりませんでした' : favoriteOnly ? 'お気に入りはまだありません' : '最初のアーティストを登録', searchValue || category ? '検索条件やカテゴリを変えて試してください。' : favoriteOnly ? 'Artistsから★を付けて、お気に入りを作りましょう。' : 'URLだけで登録できます。', favoriteOnly || searchValue || category ? 'Artistsへ移動' : 'URLを登録', favoriteOnly || searchValue || category ? '#/artists' : '#/quick-add')}`, favoriteOnly ? 'favorites' : 'artists');
    const search = document.querySelector('#artist-search'); search?.addEventListener('input', e => { window._artistSearch = e.target.value; renderArtists(favoriteOnly); requestAnimationFrame(() => { const input = document.querySelector('#artist-search'); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }); });
    document.querySelector('#sort-select')?.addEventListener('change', e => { state.settings.sortMode = e.target.value; save(); renderArtists(favoriteOnly); });
  }
  function renderArtistDetail(id) {
    const artist = state.artists.find(a => a.id === id); if (!artist) return navigate('artists');
    artist.lastOpenedAt = now(); save();
    pageShell(`<div class="detail-header"><button class="icon-btn" type="button" data-back aria-label="戻る"><svg><use href="#icon-back"></use></svg></button><span class="spacer"></span><button class="icon-btn star${artist.favorite ? ' active' : ''}" type="button" data-action="toggle-favorite" data-id="${esc(artist.id)}" aria-label="お気に入り${artist.favorite ? 'を外す' : 'に追加'}"><svg><use href="#icon-star"></use></svg></button><a class="icon-btn" href="#/edit-artist/${encodeURIComponent(artist.id)}" aria-label="アーティストを編集"><svg><use href="#icon-edit"></use></svg></a><button class="icon-btn" type="button" data-action="delete-artist" data-id="${esc(artist.id)}" aria-label="アーティストを削除"><svg><use href="#icon-trash"></use></svg></button></div><section class="profile-hero">${avatar(artist, true)}<h1>${esc(artist.name)}</h1>${artist.handle ? `<p class="artist-handle">${esc(artist.handle)}</p>` : ''}${safeUrl(artist.profileUrl) ? `<a class="btn btn-primary" href="${esc(safeUrl(artist.profileUrl))}" target="_blank" rel="noopener noreferrer"><svg><use href="#icon-external"></use></svg>Sunoで開く</a>` : ''}</section>${artist.categoryIds.length || artist.tags.length ? `<section class="detail-block"><p class="detail-label">カテゴリ / タグ</p><div class="tag-row">${chipsFor(artist)}</div></section>` : ''}${artist.memo ? `<section class="detail-block"><p class="detail-label">メモ</p><div class="memo-box card">${esc(artist.memo)}</div></section>` : ''}<section class="detail-block"><div class="section-title"><h2>参照リンク</h2></div><div class="notice"><strong>Suno側で操作：</strong>プロフィールを開いて、いいね・コメント・フォローなどを行えます。</div>${safeUrl(artist.profileUrl) ? `<a class="btn btn-primary detail-open-btn" href="${esc(safeUrl(artist.profileUrl))}" target="_blank" rel="noopener noreferrer"><svg><use href="#icon-external"></use></svg>公式アプリ / Safariで開く</a>` : ''}</section>`, 'artists');
  }
  function renderArtistForm(id = '') {
    const existing = state.artists.find(a => a.id === id); const artist = existing || { name: '', handle: '', profileUrl: '', iconUrl: '', categoryIds: [], favorite: false, memo: '', tags: [] }; const sharedUrl = !id ? sharedLink() : '';
    pageShell(`<div class="detail-header"><button class="icon-btn" type="button" data-back aria-label="戻る"><svg><use href="#icon-back"></use></svg></button><span class="spacer"></span></div><header class="page-header"><div><p class="eyebrow">${id ? 'Edit artist' : 'Quick add'}</p><h1>${id ? '編集' : 'URLを登録'}</h1><p class="subtitle">${id ? 'あとから好きな情報を足せます。' : '名前やカテゴリは後回し。まずURLだけ保存できます。'}</p></div></header><form id="artist-form" class="form-page card"><div class="field"><label for="artist-profile-url">SunoプロフィールURL</label><input id="artist-profile-url" name="profileUrl" type="url" placeholder="https://suno.com/@..." value="${esc(sharedUrl || artist.profileUrl)}" required autofocus></div>${!id ? `<div class="quick-url-hint">共有リンクから来たURLは自動入力されています。URLだけでも登録できます。</div>` : ''}<div class="field"><label for="artist-name">表示名 <span class="optional">任意</span></label><input id="artist-name" name="name" value="${esc(artist.name)}" placeholder="空欄ならURLから仮名を作成" maxlength="80"></div><div class="field"><label for="handle">Suno handle <span class="optional">任意</span></label><input id="handle" name="handle" placeholder="@username" value="${esc(artist.handle)}" maxlength="80"></div><div class="field"><label>カテゴリ <span class="optional">複数選択可</span></label><div class="checkbox-grid">${state.categories.map(c => `<label class="check-chip"><input type="checkbox" name="categoryIds" value="${esc(c.id)}" ${artist.categoryIds.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('') || '<p class="no-category-note">カテゴリはSettingsから追加できます。</p>'}</div></div><div class="field"><label for="artist-memo">メモ <span class="optional">任意</span></label><textarea id="artist-memo" name="memo" maxlength="1000" placeholder="このアーティストを見たい理由など">${esc(artist.memo)}</textarea></div><div class="field"><label for="artist-tags">タグ <span class="optional">任意・カンマ区切り</span></label><input id="artist-tags" name="tags" value="${esc(artist.tags.join(', '))}" placeholder="electropop, reference"></div><label class="favorite-toggle"><input type="checkbox" name="favorite" ${artist.favorite ? 'checked' : ''}><span>★ お気に入りに追加</span></label><div class="form-actions"><button class="btn btn-ghost" type="button" data-back>キャンセル</button><button class="btn btn-primary" type="submit">${id ? '保存' : '登録する'}</button></div></form>`, 'artists');
    const form = document.querySelector('#artist-form');
    form.addEventListener('submit', e => { e.preventDefault(); const fd = new FormData(form); const profileUrl = safeUrl(fd.get('profileUrl')); if (!profileUrl) return notify('正しいURLを入力してください'); const name = fd.get('name').trim() || deriveName(profileUrl, params().get('title') || ''); const record = { name, profileUrl, handle: fd.get('handle').trim(), iconUrl: artist.iconUrl || '', categoryIds: fd.getAll('categoryIds'), favorite: fd.get('favorite') === 'on', memo: fd.get('memo').trim(), tags: cleanTags(fd.get('tags')) }; if (id) { Object.assign(existing, record); save(); notify('保存しました'); navigate(`artist/${encodeURIComponent(id)}`); } else { const newArtist = { id: uid('artist'), ...record, sortOrder: state.artists.length, createdAt: now(), lastOpenedAt: '' }; state.artists.push(newArtist); save(); notify('アーティストを登録しました'); navigate(`artist/${encodeURIComponent(newArtist.id)}`); } });
  }
  function renderSettings() {
    pageShell(`<header class="page-header"><div><p class="eyebrow">Preferences</p><h1>Settings</h1><p class="subtitle">この端末のSuno Patrolを管理</p></div></header><div class="settings-list"><section class="settings-card card"><h2>データ</h2><p>アーティストとカテゴリをJSONファイルとして保存・復元できます。</p><div class="settings-actions"><button class="btn btn-primary btn-small" data-action="export"><svg><use href="#icon-download"></use></svg>バックアップを書き出す</button><button class="btn btn-ghost btn-small" data-action="open-import"><svg><use href="#icon-upload"></use></svg>バックアップを読み込む</button></div></section><section class="settings-card card"><h2>カテゴリ</h2><p>アーティストを整理するカテゴリを自由に追加できます。</p><ul class="category-list">${state.categories.sort((a,b) => a.sortOrder - b.sortOrder).map(c => `<li class="category-item"><span>${esc(c.name)}</span><button type="button" data-action="delete-category" data-id="${esc(c.id)}" aria-label="${esc(c.name)}を削除">×</button></li>`).join('') || '<li class="faint">カテゴリはありません</li>'}</ul><form class="inline-form" id="category-form"><input name="name" placeholder="例：Electronic" aria-label="新しいカテゴリ名" maxlength="30" required><button class="btn btn-ghost btn-small" type="submit">追加</button></form></section><section class="settings-card card"><h2>共有から登録</h2><p>iPhoneではPWAを共有先に直接指定できないため、iOSショートカットで #/quick-add?url=... に渡す方式が安定します。Androidなど対応ブラウザではManifestの共有先も利用できます。</p><div class="notice"><strong>登録は端末内だけ：</strong>アカウント情報やSunoのログイン情報は保存しません。</div></section><section class="settings-card card"><h2>Suno Patrolについて</h2><p>Sunoで見つけたアーティストを覚えておく、非公式・非提携の個人用参照リンク集です。いいね・コメント・フォローはSuno公式側で行います。</p></section></div>`, 'settings');
    document.querySelector('#category-form')?.addEventListener('submit', e => { e.preventDefault(); const name = new FormData(e.target).get('name').trim(); if (!name) return; if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return notify('同じカテゴリがすでにあります'); state.categories.push({ id: uid('cat'), name, sortOrder: state.categories.length }); save(); renderSettings(); notify('カテゴリを追加しました'); });
  }
  function exportData() { const blob = new Blob([JSON.stringify({ ...state, exportedAt: now(), app: 'Suno Patrol' }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `suno-patrol-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500); notify('バックアップを書き出しました'); }
  function openImport() { importDialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><h2 id="import-dialog-title">バックアップを読み込む</h2><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><p class="muted">JSONバックアップを読み込みます。現在のデータは置き換えられます。</p><div class="field"><label for="backup-file">JSONファイル</label><input id="backup-file" type="file" accept="application/json,.json"></div><div class="form-actions"><button class="btn btn-ghost" type="button" data-close-dialog>キャンセル</button><button class="btn btn-primary" type="button" data-action="import-file">読み込む</button></div></div>`; importDialog.showModal(); }
  async function importFile() { const file = importDialog.querySelector('#backup-file')?.files?.[0]; if (!file) return notify('JSONファイルを選択してください'); try { const parsed = JSON.parse(await file.text()); if (!Array.isArray(parsed.artists) || !Array.isArray(parsed.categories)) throw new Error(); state = normalizeState(parsed); save(); importDialog.close(); render(); notify('バックアップを読み込みました'); } catch { notify('読み込めるバックアップではありません'); } }
  function moveArtist(id, direction) { const list = [...state.artists].sort((a,b) => a.sortOrder - b.sortOrder); const i = list.findIndex(a => a.id === id); const next = i + direction; if (i < 0 || next < 0 || next >= list.length) return; [list[i], list[next]] = [list[next], list[i]]; list.forEach((a, index) => a.sortOrder = index); save(); render(); }
  function render() { const current = route(); if (current.name === 'artists') renderArtists(); else if (current.name === 'favorites') renderArtists(true); else if (current.name === 'artist') renderArtistDetail(decodeURIComponent(current.id)); else if (current.name === 'quick-add') renderArtistForm(); else if (current.name === 'edit-artist') renderArtistForm(decodeURIComponent(current.id)); else if (current.name === 'settings') renderSettings(); else renderHome(); }

  document.addEventListener('click', e => {
    const actionTarget = e.target.closest('[data-action]'); const action = actionTarget?.dataset.action;
    if (action === 'toggle-favorite') { const artist = state.artists.find(a => a.id === actionTarget.dataset.id); if (artist) { artist.favorite = !artist.favorite; save(); render(); notify(artist.favorite ? 'お気に入りに追加しました' : 'お気に入りから外しました'); } }
    if (action === 'delete-artist') { const id = actionTarget.dataset.id; if (confirm('このアーティストを削除しますか？')) { state.artists = state.artists.filter(a => a.id !== id); save(); navigate('artists'); notify('削除しました'); } }
    if (action === 'export') exportData();
    if (action === 'open-import') openImport();
    if (action === 'import-file') importFile();
    if (action === 'delete-category') { const id = actionTarget.dataset.id; if (confirm('このカテゴリを削除しますか？所属アーティストからも外れます。')) { state.categories = state.categories.filter(c => c.id !== id); state.artists.forEach(a => a.categoryIds = a.categoryIds.filter(cid => cid !== id)); save(); renderSettings(); notify('カテゴリを削除しました'); } }
    if (e.target.closest('[data-move]')) { const button = e.target.closest('[data-move]'); moveArtist(button.dataset.id, button.dataset.move === 'up' ? -1 : 1); }
    if (e.target.closest('[data-back]')) history.length > 1 ? history.back() : navigate('artists');
    if (e.target.closest('[data-close-dialog]')) e.target.closest('dialog')?.close();
  });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }));
  window.addEventListener('hashchange', render); window.addEventListener('DOMContentLoaded', () => { if (!location.hash && !sharedLink()) navigate('home'); else render(); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
