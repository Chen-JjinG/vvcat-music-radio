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
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-22% 0px -62% 0px', threshold: [0, .15, .3, .5] });
    ['intro', 'radio', 'works', 'about'].forEach(id => { const el = $(id); if (el) observer.observe(el); });
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
      button.querySelector('.track-row-copy span').textContent = compact ? track.subtitle : `${track.subtitle} · ${formatTime(track.duration || 18)}`;
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
    setText('trackCount', `${String(tracks.length).padStart(2, '0')} TRACKS · DEMO`);
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
    setText('radioTrackSub', 'DEMO MODE · ' + track.subtitle);
    setText('bottomTrackTitle', track.title);
    setText('bottomTrackSub', track.subtitle);
    $('bottomPlay')?.setAttribute('aria-label', audio.paused ? '播放' : '暂停');
    $('radioPlay')?.setAttribute('aria-label', audio.paused ? '播放演示音轨' : '暂停演示音轨');
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
    setText('radioState', playing ? 'PLAYING · SIGNAL FOUND' : 'READY · 点击作品开始播放');
    document.querySelectorAll('.track-row').forEach(row => {
      if (Number(row.dataset.track) === currentIndex) {
        const iconNode = row.querySelector('.track-row-play');
        if (iconNode) iconNode.textContent = playing ? 'Ⅱ' : '▶';
      }
    });
    updateTrackSelection();
  }

  function syncProgress() {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : ((currentTrack() || {}).duration || 18);
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
    try {
      await audio.play();
      syncPlayState();
    } catch (error) {
      console.warn('Audio playback did not start:', error);
      setText('radioState', '播放未启动 · 请再点一次播放');
      openNotice('音频无法播放', '浏览器可能阻止了播放，或演示音频文件无法读取。请检查 assets/audio 文件是否存在，然后再试一次。');
      syncPlayState();
    }
  }
  function pauseTrack() { audio.pause(); syncPlayState(); }
  function togglePlay() { if (audio.paused) playTrack(); else pauseTrack(); }
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
  $('radioVolume')?.addEventListener('input', e => {
    audio.volume = Number(e.target.value) / 100;
    $('bottomVolume').value = e.target.value;
    setText('radioVolumeLabel', e.target.value);
    setText('bottomVolumeLabel', `${e.target.value}%`);
  });
  $('bottomVolume')?.addEventListener('input', e => {
    audio.volume = Number(e.target.value) / 100;
    $('radioVolume').value = e.target.value;
    setText('radioVolumeLabel', e.target.value);
    setText('bottomVolumeLabel', `${e.target.value}%`);
  });
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
  const commitSeek = (value, maxValue) => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : maxValue;
    audio.currentTime = Math.min(duration, Math.max(0, value));
    isSeeking = false;
    syncProgress();
  };
  bottomProgress?.addEventListener('pointerdown', () => { isSeeking = true; });
  bottomProgress?.addEventListener('input', () => {
    const duration = Number(bottomProgress.max) || 18;
    previewSeek(Number(bottomProgress.value), duration);
  });
  bottomProgress?.addEventListener('change', () => commitSeek(Number(bottomProgress.value), Number(bottomProgress.max) || 18));
  bottomProgress?.addEventListener('pointerup', () => { if (isSeeking) commitSeek(Number(bottomProgress.value), Number(bottomProgress.max) || 18); });
  radioProgress?.addEventListener('pointerdown', () => { isSeeking = true; });
  radioProgress?.addEventListener('input', () => {
    const duration = Number(radioProgress.max) || 18;
    previewSeek(Number(radioProgress.value), duration);
  });
  radioProgress?.addEventListener('change', () => commitSeek(Number(radioProgress.value), Number(radioProgress.max) || 18));
  radioProgress?.addEventListener('pointerup', () => { if (isSeeking) commitSeek(Number(radioProgress.value), Number(radioProgress.max) || 18); });
  audio.volume = 0.75;
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

  // The about dialog is shared by the header target and the radio's legacy-style button.
  $('aboutTrigger')?.addEventListener('click', () => {
    if (typeof $('aboutDialog').showModal === 'function') $('aboutDialog').showModal();
    else openNotice('关于这只猫', '俺是一只黑橙色的猫，喜欢捣鼓音乐。');
  });
  $('dialogClose')?.addEventListener('click', () => $('aboutDialog').close());
  $('aboutDialog')?.addEventListener('click', event => {
    const rect = $('aboutDialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('aboutDialog').close();
  });
  $('messageClose')?.addEventListener('click', () => $('messageDialog').close());
  $('messageOk')?.addEventListener('click', () => $('messageDialog').close());

  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.project;
    const title = key === 'fuyu' ? '《缚语》' : '《缚育宅姬》';
    const url = (config.projectLinks || {})[key];
    if (url && /^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    else openNotice(title, '这里使用的是演示封面，尚未配置真实项目链接。正式版请替换为实际游戏/项目封面，并在 js/config.js 中填写已确认的作品地址。');
  }));
  document.querySelectorAll('.original-track').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.track);
    if (index === currentIndex && !audio.paused) pauseTrack(); else selectTrack(index, true);
  }));
  $('contactButton')?.addEventListener('click', () => {
    const url = config.contactUrl;
    if (url && /^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    else openNotice('合作联系', '当前 Demo 没有预设邮箱或社交账号，避免展示虚构联系方式。请在 js/config.js 的 contactUrl 中填写你实际使用的联系页面。');
  });

  // Pixel runner: pixel-grid art, self-drawn cat and cassette/speaker obstacles.
  const canvas = $('runnerCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, groundY = 195;
  const CAT = [
    '....KKKKKK.......',
    '...KKKKKKKKK.....',
    '..KKKK..KKOOK....',
    '.KKKK...KKOOOOK..',
    'KKKKKKKKKKOOOOOK.',
    'KKWWKKKKKKOOOOOK.',
    'KKKKKKKKKKOOOOOK.',
    'KKKKKKKKKKKKKKK..',
    '.KKKKKKKKKKKKK...',
    '..KKKKKKKKKKK....',
    '...KKK..KK........',
    '..KK....KKK.......'
  ];
  let game = { state: 'idle', y: groundY - CAT.length * 5, vy: 0, speed: 235, score: 0, hi: 0, obstacles: [], spawn: 300, last: 0, runFrame: 0 };
  try { game.hi = Number(localStorage.getItem('vvcatRunnerHi') || 0); } catch (_) { game.hi = 0; }
  setText('hiScore', String(game.hi).padStart(5, '0'));
  function drawPixelCat(x, y, running = false, airborne = false) {
    const cell = 5;
    const bob = running && !airborne ? Math.sin(game.runFrame * .018) * 2 : 0;
    const py = Math.round(y + bob);
    for (let row = 0; row < CAT.length; row++) {
      for (let col = 0; col < CAT[row].length; col++) {
        const ch = CAT[row][col]; if (ch === '.') continue;
        ctx.fillStyle = ch === 'O' ? '#ed5a1a' : ch === 'W' ? '#fff5df' : '#171513';
        ctx.fillRect(Math.round(x + col * cell), Math.round(py + row * cell), cell, cell);
      }
    }
    // Feet switch between two crisp pixel poses.
    if (running && !airborne && Math.floor(game.runFrame / 7) % 2 === 0) {
      ctx.fillStyle = '#171513'; ctx.fillRect(x + 10, py + 60, 12, 5); ctx.fillRect(x + 48, py + 58, 10, 5);
    } else if (running && !airborne) {
      ctx.fillStyle = '#171513'; ctx.fillRect(x + 13, py + 58, 9, 5); ctx.fillRect(x + 48, py + 62, 12, 5);
    }
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
    drawPixelCat(65, game.y, game.state === 'running', game.y < groundY - CAT.length * 5 - 2);
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
    game.state = 'running'; game.y = groundY - CAT.length * 5; game.vy = 0; game.speed = 235; game.score = 0; game.obstacles = []; game.spawn = 300; game.last = performance.now(); game.runFrame = 0;
    $('gameOverlay').hidden = true; setText('gameStatus', 'RUNNING · KEEP GOING');
    canvas.focus({ preventScroll: true });
    if (!reduceMotion) requestAnimationFrame(gameLoop); else requestAnimationFrame(gameLoop);
    drawGame();
  }
  function jump() {
    if (game.state === 'idle' || game.state === 'over') { startGame(); return; }
    if (game.y >= groundY - CAT.length * 5 - 1) game.vy = -430;
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
    const floorY = groundY - CAT.length * 5;
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
    const cat = { x: 73, y: game.y + 8, w: 65, h: 49 };
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
  game.y = groundY - CAT.length * 5;
  drawGame();
  renderTrackLists();
  if (tracks.length) {
    audio.src = tracks[0].src;
    audio.load();
    updateTrackSelection(); syncProgress(); syncPlayState();
  }
})();
