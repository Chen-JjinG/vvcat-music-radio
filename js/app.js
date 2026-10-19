(() => {
  'use strict';
  const config = window.VVCAT_CONFIG || {};
  const tracks = Array.isArray(config.tracks) ? config.tracks : [];
  const $ = (id) => document.getElementById(id);
  const audio = $('sharedAudio');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let currentIndex = 0;
  let isSeeking = false;
  let volumePanelOpen = !window.matchMedia('(max-width: 760px)').matches;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };
  const currentTrack = () => tracks[currentIndex] || null;
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const openNotice = (title, message) => {
    setText('messageTitle', title);
    setText('messageText', message);
    const dialog = $('messageDialog');
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else window.alert(`${title}\n\n${message}`);
  };

  // Mobile navigation
  const menuToggle = $('menuToggle');
  const mainNav = $('mainNav');
  menuToggle?.addEventListener('click', () => {
    const open = mainNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  });
  mainNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', '打开导航菜单');
  }));

  // Highlight the active section without changing the page's layout.
  const navLinks = [...document.querySelectorAll('.nav-link')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const candidates = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (!candidates.length) return;
      const id = candidates[0].target.id;
      // 已经在介绍区时，猫头顶的「点击了解我」提示没有存在意义，先收起来。
      $('catCompanion')?.classList.toggle('is-intro', id === 'intro');
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-22% 0px -62% 0px', threshold: [0, .15, .3, .5] });
    ['intro', 'radio', 'works', 'contact'].forEach(id => { const el = $(id); if (el) observer.observe(el); });
  }

  function renderTrackLists() {
    const mainList = $('radioTrackList');
    const bottomList = $('bottomTrackList');
    const makeRow = (track, index, compact = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'track-row';
      button.dataset.track = String(index);
      button.setAttribute('aria-label', `播放 ${track.title}`);
      button.innerHTML = `
        <span class="track-row-art"><img src="assets/covers/original-demo.svg" alt="" loading="lazy"></span>
        <span class="track-row-copy"><strong></strong><span></span></span>
        <span class="track-row-play" aria-hidden="true">▶</span>`;
      button.querySelector('.track-row-copy strong').textContent = track.title;
      button.querySelector('.track-row-copy span').textContent = track.subtitle;
      button.addEventListener('click', () => {
        const same = index === currentIndex;
        if (same && !audio.paused) pauseTrack();
        else selectTrack(index, true);
      });
      return button;
    };
    if (mainList) {
      mainList.replaceChildren();
      tracks.forEach((track, index) => mainList.appendChild(makeRow(track, index)));
    }
    if (bottomList) {
      bottomList.replaceChildren();
      tracks.forEach((track, index) => bottomList.appendChild(makeRow(track, index, true)));
    }
    updateTrackSelection();
  }

  function updateTrackSelection() {
    document.querySelectorAll('[data-track]').forEach(node => {
      const active = Number(node.dataset.track) === currentIndex;
      node.classList.toggle('is-active', active);
      if (node.classList.contains('track-row')) {
        node.setAttribute('aria-current', active ? 'true' : 'false');
        const icon = node.querySelector('.track-row-play');
        if (icon) icon.textContent = active && !audio.paused ? 'Ⅱ' : '▶';
      }
    });
    const track = currentTrack();
    if (!track) return;
    setText('radioTrackTitle', track.title);
    setText('radioTrackSub', 'vvcat 原创 · ' + track.subtitle);
    setText('bottomTrackTitle', track.title);
    setText('bottomTrackSub', track.subtitle);
    $('bottomPlay')?.setAttribute('aria-label', audio.paused ? '播放' : '暂停');
    $('radioPlay')?.setAttribute('aria-label', audio.paused ? '播放' : '暂停');
  }

  function syncPlayState() {
    const playing = !audio.paused && !audio.ended;
    const icon = playing ? 'Ⅱ' : '▶';
    const radioPlay = $('radioPlay');
    if (radioPlay) {
      radioPlay.innerHTML = `${icon}<small>PLAY / PAUSE</small>`;
      radioPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    }
    const bottomPlay = $('bottomPlay');
    if (bottomPlay) {
      bottomPlay.textContent = icon;
      bottomPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    }
    $('playingEq')?.classList.toggle('is-playing', playing);
    // 小猫跟着音乐一起摇头并冒音符。
    companion?.classList.toggle('is-listening', playing);
    if (playing) startNotes(); else stopNotes();
    setText('radioState', playing ? 'PLAYING · SIGNAL FOUND' : 'READY · 点击曲目开始播放');
    document.querySelectorAll('.track-row').forEach(row => {
      if (Number(row.dataset.track) === currentIndex) {
        const iconNode = row.querySelector('.track-row-play');
        if (iconNode) iconNode.textContent = playing ? 'Ⅱ' : '▶';
      }
    });
    updateTrackSelection();
  }

  function syncProgress() {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const percentage = duration ? Math.min(100, current / duration * 100) : 0;
    const radioProgress = $('radioProgress');
    if (radioProgress) {
      radioProgress.max = String(duration);
      if (!isSeeking) radioProgress.value = String(current);
      radioProgress.style.setProperty('--progress', `${percentage}%`);
    }
    setText('radioCurrentTime', formatTime(current));
    setText('radioDuration', formatTime(duration));
    setText('bottomCurrentTime', formatTime(current));
    setText('bottomDuration', formatTime(duration));
    const progress = $('bottomProgress');
    if (progress) {
      progress.max = String(duration);
      if (!isSeeking) progress.value = String(current);
    }
  }

  function selectTrack(index, autoplay = false) {
    if (!tracks.length) return;
    currentIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    const track = currentTrack();
    audio.pause();
    audio.src = track.src;
    audio.load();
    syncProgress();
    updateTrackSelection();
    syncPlayState();
    if (autoplay) playTrack();
  }

  async function playTrack() {
    if (!currentTrack()) return;
    if (!audio.src) audio.src = currentTrack().src;
    pausing = false;
    try {
      applyVolume(0);
      await audio.play();
      syncPlayState();
      fadeVolume(targetVolume, PLAYER_FADE.in);
    } catch (error) {
      console.warn('Audio playback did not start:', error);
      applyVolume(targetVolume);
      setText('radioState', '播放未启动 · 请再点一次播放');
      openNotice('音频无法播放', '浏览器可能阻止了播放，或音频文件无法读取。请确认 music/ 目录下的文件是否还在，然后再试一次。');
      syncPlayState();
    }
  }
  function pauseTrack() {
    if (pausing) return;
    pausing = true;
    fadeVolume(0, PLAYER_FADE.out, () => {
      audio.pause();
      applyVolume(targetVolume);
      pausing = false;
    });
  }
  function togglePlay() {
    if (pausing) { pausing = false; fadeVolume(targetVolume, PLAYER_FADE.in); return; }
    if (audio.paused) playTrack(); else pauseTrack();
  }
  function nextTrack() { selectTrack(currentIndex + 1, true); }
  function prevTrack() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (audio.currentTime > 3) { audio.currentTime = 0; syncProgress(); return; }
    selectTrack(currentIndex - 1, true);
  }

  $('radioPrev')?.addEventListener('click', prevTrack);
  $('radioNext')?.addEventListener('click', nextTrack);
  $('radioPlay')?.addEventListener('click', togglePlay);
  $('bottomPrev')?.addEventListener('click', prevTrack);
  $('bottomNext')?.addEventListener('click', nextTrack);
  $('bottomPlay')?.addEventListener('click', togglePlay);
  const applyVolumeInput = value => {
    setTargetVolume(Number(value) / 100);
    const radio = $('radioVolume');
    const bottom = $('bottomVolume');
    if (radio) radio.value = value;
    if (bottom) bottom.value = value;
    setText('radioVolumeLabel', value);
    setText('bottomVolumeLabel', `${value}%`);
  };
  $('radioVolume')?.addEventListener('input', e => applyVolumeInput(e.target.value));
  $('bottomVolume')?.addEventListener('input', e => applyVolumeInput(e.target.value));
  $('bottomVolumeToggle')?.addEventListener('click', () => {
    volumePanelOpen = !volumePanelOpen;
    const mobileLayout = window.matchMedia('(max-width: 760px)').matches;
    $('bottomVolumeToggle').setAttribute('aria-expanded', String(volumePanelOpen));
    $('bottomVolumeToggle').setAttribute('aria-label', volumePanelOpen ? '隐藏音量控制' : '显示音量控制');
    $('bottomVolumeToggle').title = volumePanelOpen ? '隐藏音量' : '音量';
    const volumeWrap = $('bottomVolume').parentElement;
    volumeWrap.classList.toggle('is-open', mobileLayout && volumePanelOpen);
    volumeWrap.classList.toggle('is-hidden', !mobileLayout && !volumePanelOpen);
  });
  $('bottomListToggle')?.addEventListener('click', () => {
    const panel = $('bottomListPopover');
    panel.hidden = !panel.hidden;
    $('bottomListToggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  $('bottomListClose')?.addEventListener('click', () => {
    $('bottomListPopover').hidden = true;
    $('bottomListToggle').setAttribute('aria-expanded', 'false');
  });
  const bottomProgress = $('bottomProgress');
  const radioProgress = $('radioProgress');
  const previewSeek = (value, duration) => {
    const safeValue = Math.max(0, Math.min(duration, value));
    setText('bottomCurrentTime', formatTime(safeValue));
    setText('radioCurrentTime', formatTime(safeValue));
    if (bottomProgress) bottomProgress.value = String(safeValue);
    if (radioProgress) {
      radioProgress.value = String(safeValue);
      radioProgress.style.setProperty('--progress', `${duration ? safeValue / duration * 100 : 0}%`);
    }
  };
  // 部分本地服务器不支持 Range 请求时浏览器会拒绝跳转，这里先判断再赋值。
  const canSeek = () => audio.seekable.length > 0 && audio.seekable.end(audio.seekable.length - 1) > 0.5;
  const commitSeek = (value, maxValue) => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : maxValue;
    const target = Math.min(duration, Math.max(0, value));
    if (canSeek()) audio.currentTime = target;
    isSeeking = false;
    syncProgress();
  };
  const sliderDuration = slider => Number(slider.max) || 0;
  bottomProgress?.addEventListener('pointerdown', () => { isSeeking = true; });
  bottomProgress?.addEventListener('input', () => previewSeek(Number(bottomProgress.value), sliderDuration(bottomProgress)));
  bottomProgress?.addEventListener('change', () => commitSeek(Number(bottomProgress.value), sliderDuration(bottomProgress)));
  bottomProgress?.addEventListener('pointerup', () => { if (isSeeking) commitSeek(Number(bottomProgress.value), sliderDuration(bottomProgress)); });
  radioProgress?.addEventListener('pointerdown', () => { isSeeking = true; });
  radioProgress?.addEventListener('input', () => previewSeek(Number(radioProgress.value), sliderDuration(radioProgress)));
  radioProgress?.addEventListener('change', () => commitSeek(Number(radioProgress.value), sliderDuration(radioProgress)));
  radioProgress?.addEventListener('pointerup', () => { if (isSeeking) commitSeek(Number(radioProgress.value), sliderDuration(radioProgress)); });
  // 音量与淡入淡出：滑块调的是目标音量，播放/暂停时用一段短过渡避免声音突兀。
  const PLAYER_FADE = { in: 700, out: 450 };
  let targetVolume = 0.75;
  let fadeTimer = null;
  let pausing = false;
  const applyVolume = value => { audio.volume = Math.max(0, Math.min(1, value)); };
  function setTargetVolume(value) {
    targetVolume = Math.max(0, Math.min(1, value));
    if (!fadeTimer) applyVolume(targetVolume);
  }
  function fadeVolume(to, ms, done) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
    const from = audio.volume;
    if (!ms || Math.abs(to - from) < 0.01) { applyVolume(to); if (done) done(); return; }
    const startedAt = performance.now();
    fadeTimer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startedAt) / ms);
      applyVolume(from + (to - from) * t * (2 - t));
      if (t >= 1) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
        applyVolume(to);
        if (done) done();
      }
    }, 40);
  }
  applyVolume(targetVolume);
  audio.addEventListener('timeupdate', syncProgress);
  audio.addEventListener('durationchange', syncProgress);
  audio.addEventListener('loadedmetadata', syncProgress);
  audio.addEventListener('play', syncPlayState);
  audio.addEventListener('pause', syncPlayState);
  audio.addEventListener('ended', () => {
    if (currentIndex < tracks.length - 1) selectTrack(currentIndex + 1, true);
    else { syncPlayState(); syncProgress(); }
  });
  audio.addEventListener('error', () => {
    setText('radioState', '音频文件未找到 · 请检查配置');
    syncPlayState();
  });

  // 自我介绍只保留在页面介绍区：这里的入口统一滚动过去，不再弹出对话窗。
  const scrollToIntro = () => $('intro')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  $('aboutTrigger')?.addEventListener('click', scrollToIntro);
  $('catHint')?.addEventListener('click', scrollToIntro);
  $('messageClose')?.addEventListener('click', () => $('messageDialog').close());
  $('messageOk')?.addEventListener('click', () => $('messageDialog').close());

  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.project;
    const title = key === 'fuyu' ? '《缚语》' : '《缚育宅姬》';
    const url = (config.projectLinks || {})[key];
    if (url && /^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    else openNotice(title, '封面已经是真实作品图了，但还没有配置作品页面地址。把地址填进 js/config.js 的 projectLinks，点击就能直接打开。');
  }));
  // 联系方式：列出配置里的 QQ，点一下即复制号码。
  const copyText = async text => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error('clipboard unavailable');
    } catch (_) {
      try {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const ok = document.execCommand('copy');
        field.remove();
        return ok;
      } catch (_) { return false; }
    }
  };

  function renderContacts() {
    const box = $('contactQqs');
    const list = Array.isArray(config.contacts) ? config.contacts : [];
    if (!box || !list.length) return;
    box.replaceChildren();
    list.forEach(item => {
      const row = document.createElement('button');
      row.type = 'button';
      // 沿用站点原有的橙色高亮主按钮样式
      row.className = 'button button-primary contact-qq';
      row.setAttribute('aria-label', `复制 ${item.name} 的 QQ 号 ${item.qq}`);
      row.innerHTML = '<span class="qq-tag">QQ</span><span class="qq-name"></span><span class="qq-num"></span><span class="qq-action">复制</span>';
      row.querySelector('.qq-name').textContent = item.name;
      row.querySelector('.qq-num').textContent = item.qq;
      row.addEventListener('click', async () => {
        const ok = await copyText(item.qq);
        const action = row.querySelector('.qq-action');
        action.textContent = ok ? '已复制 ✓' : '复制失败';
        if (!ok) openNotice('联系方式', `${item.name} 的 QQ 号：${item.qq}`);
        window.setTimeout(() => { action.textContent = '复制'; }, 1600);
      });
      box.appendChild(row);
    });
  }

  // 悬浮小猫：可以拖到任意位置的陪伴挂件，播放音乐时从身上冒出音符。
  const CAT_POS_KEY = 'catCompanionPosV4';
  const companion = $('catCompanion');
  const catFigure = document.querySelector('.cat-figure');
  const catImage = $('catImage');
  const noteCloud = $('noteCloud');
  let noteTimer = null;

  // 底部有常驻播放栏，小猫的可活动范围要把播放栏高度排除掉，避免被它盖住。
  const playerBarHeight = () => {
    const bar = $('bottomPlayer');
    return bar ? bar.getBoundingClientRect().height : 0;
  };
  const clampCatPosition = (left, top) => {
    const maxLeft = Math.max(0, window.innerWidth - companion.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - companion.offsetHeight - playerBarHeight() - 16);
    return { left: Math.min(maxLeft, Math.max(0, left)), top: Math.min(maxTop, Math.max(0, top)) };
  };
  const setCatPosition = (left, top, persist) => {
    const pos = clampCatPosition(left, top);
    companion.style.left = `${pos.left}px`;
    companion.style.top = `${pos.top}px`;
    companion.style.right = 'auto';
    companion.style.bottom = 'auto';
    if (persist) { try { localStorage.setItem(CAT_POS_KEY, JSON.stringify(pos)); } catch (_) { /* 隐私模式可能不可用 */ } }
  };
  const restoreCatPosition = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(CAT_POS_KEY) || 'null');
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) setCatPosition(saved.left, saved.top, false);
    } catch (_) { /* 忽略损坏的存档 */ }
  };

  function spawnNote() {
    if (!noteCloud) return;
    const glyphs = ['♪', '♫', '♬'];
    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    note.style.setProperty('--x', `${34 + Math.random() * 32}%`);
    note.style.setProperty('--dx', `${-22 + Math.random() * 44}px`);
    note.style.setProperty('--size', `${13 + Math.random() * 9}px`);
    note.style.setProperty('--dur', `${2.4 + Math.random() * 1.4}s`);
    note.style.setProperty('--r', `${-12 + Math.random() * 24}deg`);
    noteCloud.appendChild(note);
    window.setTimeout(() => note.remove(), 4200);
  }
  function startNotes() {
    if (noteTimer || !noteCloud) return;
    spawnNote();
    noteTimer = window.setInterval(spawnNote, 1250);
  }
  function stopNotes() {
    if (!noteTimer) return;
    window.clearInterval(noteTimer);
    noteTimer = null;
  }

  if (companion && catFigure && catImage) {
    let drag = null;
    catImage.addEventListener('pointerdown', event => {
      const rect = companion.getBoundingClientRect();
      drag = { startX: event.clientX, startY: event.clientY, baseLeft: rect.left, baseTop: rect.top, moved: 0 };
      try { catImage.setPointerCapture(event.pointerId); } catch (_) { /* 指针可能已失效 */ }
      catFigure.classList.add('is-dragging');
      event.preventDefault();
    });
    catImage.addEventListener('dragstart', event => event.preventDefault());
    catImage.addEventListener('pointermove', event => {
      if (!drag) return;
      drag.moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      setCatPosition(drag.baseLeft + event.clientX - drag.startX, drag.baseTop + event.clientY - drag.startY, false);
    });
    const finishDrag = event => {
      if (!drag) return;
      const isTap = drag.moved < 6 && event.type === 'pointerup';
      drag = null;
      catFigure.classList.remove('is-dragging');
      const rect = companion.getBoundingClientRect();
      setCatPosition(rect.left, rect.top, true);
      if (isTap) scrollToIntro();
    };
    catImage.addEventListener('pointerup', finishDrag);
    catImage.addEventListener('pointercancel', finishDrag);
    window.addEventListener('resize', () => {
      if (!companion.style.left) return;
      const rect = companion.getBoundingClientRect();
      setCatPosition(rect.left, rect.top, false);
    });
    restoreCatPosition();
  }

  // Pixel runner: pixel-grid art, self-drawn cat and cassette/speaker obstacles.
  const canvas = $('runnerCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, groundY = 195;
  // 猫改用 8bitcat.png 精灵图绘制：原图四周留白很大，这里直接取猫体所在的子区域。
  const CAT_SPRITE = { src: 'assets/cat/8bitcat.png', sx: 492, sy: 363, sw: 556, sh: 436 };
  const CAT_W = 79, CAT_H = 62;
  const catSprite = new Image();
  let catSpriteReady = false;
  catSprite.addEventListener('load', () => { catSpriteReady = true; drawGame(); });
  catSprite.src = CAT_SPRITE.src;

  let game = { state: 'idle', y: groundY - CAT_H, vy: 0, speed: 235, score: 0, hi: 0, obstacles: [], spawn: 300, last: 0, runFrame: 0 };
  try { game.hi = Number(localStorage.getItem('vvcatRunnerHi') || 0); } catch (_) { game.hi = 0; }
  setText('hiScore', String(game.hi).padStart(5, '0'));
  function drawCatSprite(x, y, running = false, airborne = false) {
    if (!catSpriteReady) return;
    const bob = running && !airborne ? Math.sin(game.runFrame * .018) * 2 : 0;
    const py = Math.round(y + bob);
    // 原图猫体约 556x436（每格约 14px），缩到 79x62 正好还原成每格 2px 的清晰像素画。
    ctx.drawImage(catSprite, CAT_SPRITE.sx, CAT_SPRITE.sy, CAT_SPRITE.sw, CAT_SPRITE.sh, Math.round(x), py, CAT_W, CAT_H);
  }
  function drawCassette(x, y) {
    ctx.fillStyle = '#292622'; ctx.fillRect(x, y, 27, 29);
    ctx.fillStyle = '#e88736'; ctx.fillRect(x + 3, y + 4, 21, 4);
    ctx.fillStyle = '#d7c4a5'; ctx.fillRect(x + 4, y + 12, 19, 10);
    ctx.fillStyle = '#292622'; ctx.fillRect(x + 7, y + 14, 4, 5); ctx.fillRect(x + 16, y + 14, 4, 5);
    ctx.fillStyle = '#e88736'; ctx.fillRect(x + 2, y + 26, 23, 3);
  }
  function drawSpeaker(x, y) {
    ctx.fillStyle = '#292622'; ctx.fillRect(x, y, 29, 38);
    ctx.fillStyle = '#c7a37a'; ctx.fillRect(x + 4, y + 4, 21, 30);
    ctx.fillStyle = '#292622'; ctx.fillRect(x + 8, y + 8, 13, 22);
    ctx.fillStyle = '#e88736'; ctx.fillRect(x + 11, y + 11, 7, 16);
  }
  function drawGame() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f4eedf'; ctx.fillRect(0, 0, W, H);
    // pixel clouds and subtle skyline
    ctx.fillStyle = '#e4d8c2';
    [[58,38,25,5],[70,33,15,5],[150,70,32,4],[164,65,15,5],[430,42,25,5],[446,37,13,5]].forEach(r => ctx.fillRect(...r));
    ctx.fillStyle = '#e8dfcd';
    [[255,120,22,55],[281,137,13,38],[514,109,26,66],[544,126,14,49]].forEach(r => ctx.fillRect(...r));
    ctx.fillStyle = '#cbb99e'; ctx.fillRect(0, groundY, W, 2);
    for (let x = -(game.score * 2 % 28); x < W; x += 28) { ctx.fillStyle = '#cbb99e'; ctx.fillRect(x, groundY + 9, 13, 2); }
    // decorative music notes as block pixels
    ctx.fillStyle = '#bf7d43';
    [[205,44],[366,87],[585,57]].forEach((p,i) => { ctx.fillRect(p[0],p[1],3,13);ctx.fillRect(p[0]+3,p[1],7,3);ctx.fillRect(p[0]-2,p[1]+11,7,4); });
    // idle scene is composed around the cat; the game uses the same palette throughout.
    drawCatSprite(65, game.y, game.state === 'running', game.y < groundY - CAT_H - 2);
    if (game.state === 'idle') {
      drawCassette(390, groundY - 29); drawSpeaker(480, groundY - 38);
      ctx.fillStyle = '#796f61'; ctx.font = '10px monospace'; ctx.textAlign = 'right'; ctx.fillText('PRESS START TO RUN', W - 15, 20);
    } else {
      game.obstacles.forEach(ob => ob.type === 'speaker' ? drawSpeaker(ob.x, groundY - ob.h) : drawCassette(ob.x, groundY - ob.h));
      ctx.fillStyle = '#65594a'; ctx.font = '12px monospace'; ctx.textAlign = 'right'; ctx.fillText(String(Math.floor(game.score)).padStart(5, '0'), W - 20, 24);
    }
  }
  function showGameOverlay(title, message, buttonLabel) {
    setText('gameOverlayTitle', title); setText('gameOverlayText', message); setText('gameStart', buttonLabel);
    $('gameOverlay').hidden = false;
  }
  function startGame() {
    game.state = 'running'; game.y = groundY - CAT_H; game.vy = 0; game.speed = 235; game.score = 0; game.obstacles = []; game.spawn = 300; game.last = performance.now(); game.runFrame = 0;
    $('gameOverlay').hidden = true; setText('gameStatus', 'RUNNING · KEEP GOING');
    canvas.focus({ preventScroll: true });
    if (!reduceMotion) requestAnimationFrame(gameLoop); else requestAnimationFrame(gameLoop);
    drawGame();
  }
  function jump() {
    if (game.state === 'idle' || game.state === 'over') { startGame(); return; }
    if (game.y >= groundY - CAT_H - 1) game.vy = -430;
  }
  function gameOver() {
    game.state = 'over';
    const finalScore = Math.floor(game.score);
    if (finalScore > game.hi) {
      game.hi = finalScore;
      try { localStorage.setItem('vvcatRunnerHi', String(game.hi)); } catch (_) { /* Storage can be unavailable in private mode. */ }
      setText('hiScore', String(game.hi).padStart(5, '0'));
    }
    setText('gameStatus', 'GAME OVER · TAKE A BREATH');
    showGameOverlay('哎呀，猫撞到音箱了！', `本轮 ${String(finalScore).padStart(5, '0')} 分 · 再跑一局？`, '再玩一次');
    drawGame();
  }
  function gameLoop(now) {
    if (game.state !== 'running') return;
    const dt = Math.min((now - game.last) / 1000 || 0, .035); game.last = now; game.runFrame += dt * 60;
    game.score += dt * 15; game.speed = Math.min(420, 235 + game.score * 1.4);
    game.vy += 1150 * dt; game.y += game.vy * dt;
    const floorY = groundY - CAT_H;
    if (game.y > floorY) { game.y = floorY; game.vy = 0; }
    game.spawn -= game.speed * dt;
    if (game.spawn <= 0) {
      const type = Math.random() > .55 ? 'speaker' : 'cassette';
      const h = type === 'speaker' ? 38 : 29;
      game.obstacles.push({ x: W + 8, h, type, w: type === 'speaker' ? 29 : 27 });
      game.spawn = 265 + Math.random() * 240 - game.speed * .12;
    }
    game.obstacles.forEach(ob => { ob.x -= game.speed * dt; });
    game.obstacles = game.obstacles.filter(ob => ob.x + ob.w > -10);
    // Approximate AABB collision around the main body, keeping jumps fair.
    const cat = { x: 84, y: game.y + 9, w: 56, h: 50 };
    for (const ob of game.obstacles) {
      const rect = { x: ob.x + 2, y: groundY - ob.h + 2, w: ob.w - 4, h: ob.h - 2 };
      if (cat.x < rect.x + rect.w && cat.x + cat.w > rect.x && cat.y < rect.y + rect.h && cat.y + cat.h > rect.y) { gameOver(); return; }
    }
    drawGame(); requestAnimationFrame(gameLoop);
  }
  $('gameStart')?.addEventListener('click', startGame);
  $('gameOverlay')?.addEventListener('click', e => { if (e.target !== $('gameStart')) startGame(); });
  canvas?.addEventListener('click', () => { canvas.focus({ preventScroll: true }); jump(); });
  canvas?.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  });
  document.addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'ArrowUp') && document.activeElement === canvas && !e.repeat) { e.preventDefault(); jump(); }
  });
  // First-paint canvas is stable and idle; nothing moves until the visitor starts the game.
  game.y = groundY - CAT_H;
  drawGame();
  renderTrackLists();
  renderContacts();
  if (tracks.length) {
    audio.src = tracks[0].src;
    audio.load();
    updateTrackSelection(); syncProgress(); syncPlayState();
  }
})();
