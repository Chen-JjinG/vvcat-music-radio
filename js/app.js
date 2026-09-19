(() => {
  'use strict';

  const PLAYER_CONFIG = {
    loopPlaylist: false,
    defaultVolume: 0.75,
    noteIntervalMs: 1250,
    fadeInMs: 700,
    fadeOutMs: 450,
  };

  const state = {
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    noteTimer: null,
    toastTimer: null,
    fadeTimer: null,
    volume: PLAYER_CONFIG.defaultVolume,
    volumeDrag: null,
  };

  const els = {
    audio: document.getElementById('audio'),
    radio: document.getElementById('radio'),
    siteHeader: document.getElementById('siteHeader'),
    playlist: document.getElementById('playlist'),
    lcdMode: document.getElementById('lcdMode'),
    trackCounter: document.getElementById('trackCounter'),
    lcdCurrent: document.getElementById('lcdCurrent'),
    lcdSignal: document.getElementById('lcdSignal'),
    currentTime: document.getElementById('currentTime'),
    durationTime: document.getElementById('durationTime'),
    progressRange: document.getElementById('progressRange'),
    volumeKnob: document.getElementById('volumeKnob'),
    volumeValue: document.getElementById('volumeValue'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playPauseIcon: document.getElementById('playPauseIcon'),
    statusLed: document.getElementById('statusLed'),
    statusText: document.getElementById('statusText'),
    catCompanion: document.getElementById('catCompanion'),
    catImage: document.getElementById('catImage'),
    noteCloud: document.getElementById('noteCloud'),
    toast: document.getElementById('toast'),
  };

  function pad2(value) {
    return String(Math.max(0, Math.floor(value))).padStart(2, '0');
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${pad2(mins)}:${pad2(secs)}`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2800);
  }

  function setStatus(message, mode = 'ready') {
    els.statusText.textContent = message;
    els.lcdMode.textContent = mode === 'playing' ? 'PLAYING' : mode === 'paused' ? 'PAUSED' : mode === 'error' ? 'ERROR' : state.playlist.length ? 'READY' : 'NO MUSIC';
  }

  function setPlayingUI(isPlaying) {
    state.isPlaying = isPlaying;
    els.radio.classList.toggle('playing', isPlaying);
    els.catCompanion.classList.toggle('is-listening', isPlaying);
    els.playPauseIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
    els.playPauseBtn.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
    if (isPlaying) startNotes();
    else stopNotes();
  }

  function updateTrackCounter() {
    const total = state.playlist.length;
    const current = state.currentIndex >= 0 ? state.currentIndex + 1 : 0;
    els.trackCounter.textContent = `${pad2(current)} / ${pad2(total)}`;
  }

  function renderPlaylist() {
    els.playlist.innerHTML = '';

    if (!state.playlist.length) {
      const empty = document.createElement('div');
      empty.className = 'playlist-empty';
      empty.textContent = 'NO MUSIC';
      els.playlist.appendChild(empty);
      els.lcdCurrent.textContent = 'NO MUSIC';
      updateTrackCounter();
      setStatus('NO MUSIC · 请在 music/ 中放入作品并更新 playlist.json');
      return;
    }

    state.playlist.forEach((track, index) => {
      const button = document.createElement('button');
      button.className = 'track-item';
      button.type = 'button';
      button.dataset.index = String(index);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-label', `播放 ${track.title}`);

      const trackIndex = document.createElement('span');
      trackIndex.className = 'track-index';
      trackIndex.textContent = pad2(index + 1);

      const title = document.createElement('span');
      title.className = 'track-title';
      title.textContent = track.title;

      const ext = document.createElement('span');
      ext.className = 'track-ext';
      const extension = String(track.file || '').split('.').pop().toUpperCase();
      ext.textContent = extension || 'AUDIO';

      button.append(trackIndex, title, ext);
      button.addEventListener('click', () => selectTrack(index, true));
      els.playlist.appendChild(button);
    });

    updateTrackCounter();
    updateActiveTrack();
  }

  function updateActiveTrack() {
    const items = els.playlist.querySelectorAll('.track-item');
    items.forEach((item, index) => {
      const active = index === state.currentIndex;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    updateTrackCounter();
  }

  function resolveTrackUrl(file) {
    return `music/${encodeURI(String(file).replace(/^\/+/, ''))}`;
  }

  function validateTrack(track) {
    return track && typeof track.title === 'string' && typeof track.file === 'string' && track.file.trim();
  }

  function selectTrack(index, autoplay) {
    if (!state.playlist.length) {
      showToast('暂无音乐作品');
      return;
    }
    if (index < 0 || index >= state.playlist.length) return;

    const track = state.playlist[index];
    if (!validateTrack(track)) {
      showToast('音乐文件配置无效');
      setStatus('音乐文件配置无效', 'error');
      return;
    }

    state.currentIndex = index;
    updateActiveTrack();
    els.lcdCurrent.textContent = track.title;
    els.audio.src = resolveTrackUrl(track.file);
    els.audio.load();
    els.progressRange.value = '0';
    els.currentTime.textContent = '00:00';
    els.durationTime.textContent = '00:00';
    setStatus(`${autoplay ? 'LOADING' : 'READY'} · ${track.title}`, autoplay ? 'playing' : 'ready');

    if (autoplay) {
      playCurrentTrack();
    } else {
      setPlayingUI(false);
    }
  }

  function fadeAudio(target, duration, onDone) {
    window.clearInterval(state.fadeTimer);
    state.fadeTimer = null;
    const start = els.audio.volume;
    if (duration <= 0 || Math.abs(target - start) < 0.01) {
      els.audio.volume = Math.max(0, Math.min(1, target));
      onDone?.();
      return;
    }
    const startTime = performance.now();
    state.fadeTimer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startTime) / duration);
      const eased = t * (2 - t);
      els.audio.volume = Math.max(0, Math.min(1, start + (target - start) * eased));
      if (t >= 1) {
        window.clearInterval(state.fadeTimer);
        state.fadeTimer = null;
        onDone?.();
      }
    }, 40);
  }

  async function playCurrentTrack() {
    if (state.currentIndex < 0 && state.playlist.length) {
      selectTrack(0, false);
    }
    if (state.currentIndex < 0) {
      showToast('暂无音乐作品');
      return;
    }

    try {
      els.audio.volume = 0;
      await els.audio.play();
      setPlayingUI(true);
      setStatus(`PLAYING · ${state.playlist[state.currentIndex].title}`, 'playing');
      fadeAudio(state.volume, PLAYER_CONFIG.fadeInMs);
    } catch (error) {
      els.audio.volume = state.volume;
      setPlayingUI(false);
      if (error && error.name === 'NotSupportedError') {
        showToast('当前浏览器不支持该音频格式');
        setStatus('当前浏览器不支持该音频格式', 'error');
      } else {
        showToast('音乐文件无法加载');
        setStatus('音乐文件无法加载', 'error');
      }
    }
  }

  function pauseCurrentTrack() {
    fadeAudio(0, PLAYER_CONFIG.fadeOutMs, () => {
      els.audio.pause();
      els.audio.volume = state.volume;
    });
    setPlayingUI(false);
    if (state.currentIndex >= 0) {
      setStatus(`PAUSED · ${state.playlist[state.currentIndex].title}`, 'paused');
    }
  }

  function togglePlayPause() {
    if (!state.playlist.length) {
      showToast('暂无音乐作品');
      return;
    }
    if (els.audio.paused) playCurrentTrack();
    else pauseCurrentTrack();
  }

  function stepTrack(direction) {
    if (!state.playlist.length) {
      showToast('暂无音乐作品');
      return;
    }

    let nextIndex = state.currentIndex + direction;
    if (state.currentIndex < 0) nextIndex = direction > 0 ? 0 : state.playlist.length - 1;

    if (nextIndex >= state.playlist.length) {
      if (PLAYER_CONFIG.loopPlaylist) nextIndex = 0;
      else nextIndex = state.playlist.length - 1;
    }
    if (nextIndex < 0) {
      if (PLAYER_CONFIG.loopPlaylist) nextIndex = state.playlist.length - 1;
      else nextIndex = 0;
    }

    const shouldPlay = state.isPlaying || !els.audio.paused;
    selectTrack(nextIndex, shouldPlay);
  }

  function handleEnded() {
    setPlayingUI(false);
    els.audio.volume = state.volume;
    if (!state.playlist.length) return;

    const isLast = state.currentIndex >= state.playlist.length - 1;
    if (isLast && !PLAYER_CONFIG.loopPlaylist) {
      setStatus(`完成 · ${state.playlist[state.currentIndex].title}`, 'paused');
      return;
    }
    stepTrack(1);
  }

  function updateProgress() {
    const duration = els.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const ratio = (els.audio.currentTime / duration) * 100;
    els.progressRange.value = String(Math.min(100, Math.max(0, ratio)));
    els.currentTime.textContent = formatTime(els.audio.currentTime);
    els.durationTime.textContent = formatTime(duration);

    const remaining = duration - els.audio.currentTime;
    if (state.isPlaying && !state.fadeTimer && els.audio.volume > 0.02 && remaining > 0 && remaining < 0.8) {
      fadeAudio(0, Math.max(280, remaining * 900));
    }
  }

  function seekAudio() {
    if (!Number.isFinite(els.audio.duration)) return;
    const percent = Number(els.progressRange.value) / 100;
    els.audio.currentTime = els.audio.duration * percent;
  }

  function updateVolumeUI() {
    const percent = Math.round(state.volume * 100);
    const angle = -130 + state.volume * 260;
    els.volumeKnob.style.setProperty('--knob-angle', `${angle}deg`);
    els.volumeValue.textContent = String(percent);
    els.volumeKnob.setAttribute('aria-valuenow', String(percent));
    els.audio.volume = state.volume;
  }

  function setVolume(value) {
    state.volume = Math.min(1, Math.max(0, value));
    updateVolumeUI();
  }

  function setVolumeFromPointer(clientY, rectTop, rectHeight) {
    const ratio = 1 - ((clientY - rectTop) / rectHeight);
    setVolume(ratio);
  }

  function startVolumeDrag(event) {
    const rect = els.volumeKnob.getBoundingClientRect();
    state.volumeDrag = { rectTop: rect.top, rectHeight: rect.height };
    els.volumeKnob.setPointerCapture?.(event.pointerId);
    setVolumeFromPointer(event.clientY, rect.top, rect.height);
  }

  function moveVolumeDrag(event) {
    if (!state.volumeDrag) return;
    setVolumeFromPointer(event.clientY, state.volumeDrag.rectTop, state.volumeDrag.rectHeight);
  }

  function endVolumeDrag() {
    state.volumeDrag = null;
  }

  function handleVolumeKey(event) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      setVolume(state.volume + .05);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setVolume(state.volume - .05);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setVolume(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setVolume(1);
    }
  }

  function spawnNote() {
    if (!state.isPlaying) return;
    const glyphs = ['♪', '♫', '♬'];
    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    note.style.setProperty('--x', `${34 + Math.random() * 32}%`);
    note.style.setProperty('--dx', `${-22 + Math.random() * 44}px`);
    note.style.setProperty('--size', `${13 + Math.random() * 9}px`);
    note.style.setProperty('--dur', `${2.4 + Math.random() * 1.4}s`);
    note.style.setProperty('--r', `${-12 + Math.random() * 24}deg`);
    els.noteCloud.appendChild(note);
    window.setTimeout(() => note.remove(), 4200);
  }

  function startNotes() {
    if (state.noteTimer || !state.isPlaying) return;
    spawnNote();
    state.noteTimer = window.setInterval(spawnNote, PLAYER_CONFIG.noteIntervalMs);
  }

  function stopNotes() {
    if (state.noteTimer) {
      window.clearInterval(state.noteTimer);
      state.noteTimer = null;
    }
  }

  function readEmbeddedPlaylist() {
    try {
      const raw = document.getElementById('embeddedPlaylist')?.textContent;
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  async function loadPlaylist() {
    let data = null;
    let fetchFailed = false;
    try {
      const response = await fetch('music/playlist.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch {
      // file:// 直接打开或 playlist.json 缺失时，回退到页面内置列表
      fetchFailed = true;
      data = readEmbeddedPlaylist();
    }

    if (!Array.isArray(data)) {
      state.playlist = [];
      renderPlaylist();
      setStatus('暂无音乐作品');
      showToast('playlist.json 加载失败：暂无音乐作品');
      return;
    }

    state.playlist = data.filter(Boolean).map((track) => ({
      title: String(track.title ?? 'Untitled'),
      file: String(track.file ?? ''),
    }));

    renderPlaylist();
    if (state.playlist.length) {
      setStatus('READY · 点击作品开始播放');
      els.lcdCurrent.textContent = state.playlist[0].title;
      if (fetchFailed && location.protocol === 'file:') {
        showToast('当前为本地直接打开，已使用内置播放列表');
      }
    }
  }

  function bindEvents() {
    els.playPauseBtn.addEventListener('click', togglePlayPause);
    els.prevBtn.addEventListener('click', () => stepTrack(-1));
    els.nextBtn.addEventListener('click', () => stepTrack(1));
    els.progressRange.addEventListener('input', seekAudio);

    els.volumeKnob.addEventListener('pointerdown', startVolumeDrag);
    els.volumeKnob.addEventListener('pointermove', moveVolumeDrag);
    els.volumeKnob.addEventListener('pointerup', endVolumeDrag);
    els.volumeKnob.addEventListener('pointercancel', endVolumeDrag);
    els.volumeKnob.addEventListener('keydown', handleVolumeKey);
    els.volumeKnob.addEventListener('wheel', (event) => {
      event.preventDefault();
      setVolume(state.volume + (event.deltaY < 0 ? .05 : -.05));
    }, { passive: false });

    els.audio.addEventListener('timeupdate', updateProgress);
    els.audio.addEventListener('loadedmetadata', updateProgress);
    els.audio.addEventListener('play', () => setPlayingUI(true));
    els.audio.addEventListener('pause', () => {
      if (!els.audio.ended) setPlayingUI(false);
    });
    els.audio.addEventListener('ended', handleEnded);
    els.audio.addEventListener('error', () => {
      setPlayingUI(false);
      const mediaError = els.audio.error;
      if (mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        showToast('音乐文件无法加载');
        setStatus('音乐文件无法加载', 'error');
      } else {
        showToast('音乐文件无法加载');
        setStatus('音乐文件无法加载', 'error');
      }
    });

    document.addEventListener('pointerup', endVolumeDrag);
  }

  const CAT_POS_KEY = 'catCompanionPos';

  function clampCatPosition(left, top) {
    const width = els.catCompanion.offsetWidth;
    const height = els.catCompanion.offsetHeight;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    return {
      left: Math.min(maxLeft, Math.max(0, left)),
      top: Math.min(maxTop, Math.max(0, top)),
    };
  }

  function setCatPosition(left, top, persist) {
    const pos = clampCatPosition(left, top);
    els.catCompanion.style.left = `${pos.left}px`;
    els.catCompanion.style.top = `${pos.top}px`;
    els.catCompanion.style.right = 'auto';
    els.catCompanion.style.bottom = 'auto';
    if (persist) {
      try { localStorage.setItem(CAT_POS_KEY, JSON.stringify(pos)); } catch { /* 忽略存储失败 */ }
    }
  }

  function restoreCatPosition() {
    try {
      const raw = localStorage.getItem(CAT_POS_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (Number.isFinite(pos?.left) && Number.isFinite(pos?.top)) {
        setCatPosition(pos.left, pos.top, false);
      }
    } catch { /* 忽略损坏的存储数据 */ }
  }

  function bindCatDrag() {
    const img = els.catImage;
    if (!img) return;
    let drag = null;

    img.addEventListener('pointerdown', (event) => {
      const rect = els.catCompanion.getBoundingClientRect();
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        baseLeft: rect.left,
        baseTop: rect.top,
      };
      try { img.setPointerCapture?.(event.pointerId); } catch { /* 指针可能已失效 */ }
      img.classList.add('is-dragging');
      event.preventDefault();
    });

    img.addEventListener('dragstart', (event) => event.preventDefault());

    img.addEventListener('pointermove', (event) => {
      if (!drag) return;
      setCatPosition(
        drag.baseLeft + event.clientX - drag.startX,
        drag.baseTop + event.clientY - drag.startY,
        false,
      );
    });

    const finishDrag = () => {
      if (!drag) return;
      drag = null;
      img.classList.remove('is-dragging');
      const rect = els.catCompanion.getBoundingClientRect();
      setCatPosition(rect.left, rect.top, true);
    };
    img.addEventListener('pointerup', finishDrag);
    img.addEventListener('pointercancel', finishDrag);

    window.addEventListener('resize', () => {
      if (!els.catCompanion.style.left) return;
      const rect = els.catCompanion.getBoundingClientRect();
      setCatPosition(rect.left, rect.top, false);
    });
  }

  function bindHeaderCollapse() {
    if (!els.siteHeader) return;
    const update = () => {
      els.siteHeader.classList.toggle('is-hidden', window.scrollY > 64);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initialise() {
    els.audio.volume = PLAYER_CONFIG.defaultVolume;
    setVolume(PLAYER_CONFIG.defaultVolume);
    renderPlaylist();
    bindEvents();
    bindHeaderCollapse();
    restoreCatPosition();
    bindCatDrag();
    loadPlaylist();
  }

  initialise();
})();
