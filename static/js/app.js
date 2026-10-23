/**
 * مُحَفِّظ — Frontend Application Logic
 * Quran Memorization & Recitation Correction App
 */

// ─── State ──────────────────────────────────────────────────────────────────
let currentSurah    = null;
let currentAyahIdx  = 0;
let mediaRecorder   = null;
let audioChunks     = [];
let isRecording     = false;
let sessionCorrect  = 0;
let sessionErrors   = 0;
let sessionAttempts = 0;

const tips = [
  "اجلس في مكان هادئ وقل أعوذ بالله من الشيطان الرجيم قبل البدء.",
  "رتّل القرآن ترتيلاً واضحاً ومجوّداً لتحصل على أفضل نتيجة.",
  "اضغط زر 'استمع' أولاً لتسمع تلاوة الشيخ ثم كرّرها بعده.",
  "إذا أخطأت في كلمة، حاول مرة أخرى مع التركيز على مخرج الحرف.",
  "التكرار هو مفتاح الحفظ — اهدف لتلاوة كل آية ثلاث مرات صحيحة.",
  "يمكنك التنقل بين الآيات بالنقر على النقاط في الأعلى.",
  "استخدم سماعات الرأس لتحسين جودة الصوت المسجّل.",
  "التجويد يساعد على الحفظ — انتبه للمدود والغنن.",
];

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const surahSelect        = document.getElementById('surahSelect');
const surahNameEl        = document.getElementById('surahName');
const ayahCounterEl      = document.getElementById('ayahCounter');
const ayahTextDisplay    = document.getElementById('ayahTextDisplay');
const ayahNumberBadge    = document.getElementById('ayahNumberBadge');
const ayahDots           = document.getElementById('ayahDots');
const resultBadge        = document.getElementById('resultBadge');
const transcribedSection = document.getElementById('transcribedSection');
const transcribedText    = document.getElementById('transcribedText');
const matchSection       = document.getElementById('matchSection');
const matchPercent       = document.getElementById('matchPercent');
const matchBar           = document.getElementById('matchBar');
const statusText         = document.getElementById('statusText');
const micBtn             = document.getElementById('micBtn');
const micIcon            = document.getElementById('micIcon');
const stopIcon           = document.getElementById('stopIcon');
const waveform           = document.getElementById('waveform');
const retryBtn           = document.getElementById('retryBtn');
const sheikhAudio        = document.getElementById('sheikhAudio');
const sessionScoreEl     = document.getElementById('sessionScore');
const statCorrect        = document.getElementById('statCorrect');
const statErrors         = document.getElementById('statErrors');
const statAttempts       = document.getElementById('statAttempts');
const tipText            = document.getElementById('tipText');
const playBtn            = document.getElementById('playBtn');

// ─── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  rotateTip();
  setInterval(rotateTip, 12000);
  createParticles();
  loadSurah(parseInt(surahSelect.value));
});

surahSelect.addEventListener('change', () => {
  loadSurah(parseInt(surahSelect.value));
});

// ─── Load Surah ───────────────────────────────────────────────────────────────
async function loadSurah(surahNumber) {
  setStatus('جاري تحميل السورة…');
  try {
    const resp = await fetch(`/api/surah/${surahNumber}`);
    if (!resp.ok) throw new Error('فشل تحميل السورة');
    currentSurah   = await resp.json();
    currentAyahIdx = 0;
    surahNameEl.textContent = `سورة ${currentSurah.name}`;
    buildDots();
    renderAyah();
    clearResult();
    setStatus('');
  } catch (e) {
    setStatus('❌ خطأ في تحميل السورة');
    console.error(e);
  }
}

// ─── Render Ayah ─────────────────────────────────────────────────────────────
function renderAyah(wordResults = null) {
  if (!currentSurah) return;
  const ayah  = currentSurah.ayahs[currentAyahIdx];
  const total = currentSurah.ayahs.length;

  ayahNumberBadge.textContent = toArabicNum(ayah.number);
  ayahCounterEl.textContent   = `${toArabicNum(currentAyahIdx + 1)} / ${toArabicNum(total)}`;
  updateDots();

  ayahTextDisplay.innerHTML = '';
  const words = ayah.text.split(' ').filter(w => w.trim());

  if (wordResults && wordResults.length > 0) {
    wordResults.forEach((wr, i) => {
      const span = document.createElement('span');
      span.textContent = wr.word;
      span.className   = wr.correct ? 'word-correct' : 'word-incorrect';
      ayahTextDisplay.appendChild(span);
      if (i < wordResults.length - 1) {
        ayahTextDisplay.appendChild(document.createTextNode(' '));
      }
    });
  } else {
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.className   = 'word-normal';
      ayahTextDisplay.appendChild(span);
      if (i < words.length - 1) {
        ayahTextDisplay.appendChild(document.createTextNode(' '));
      }
    });
  }

  loadSheikhAudio();
}

// ─── Sheikh Audio ─────────────────────────────────────────────────────────────
async function loadSheikhAudio() {
  if (!currentSurah) return;
  const ayah = currentSurah.ayahs[currentAyahIdx];
  try {
    const resp = await fetch(`/api/audio/${surahSelect.value}/${ayah.number}`);
    const data = await resp.json();
    sheikhAudio.src = data.url;
    sheikhAudio.load();
  } catch (e) { /* silent */ }
}

function playSheikhAudio() {
  if (!sheikhAudio.src) { setStatus('جاري التحميل…'); return; }
  sheikhAudio.currentTime = 0;
  sheikhAudio.play().catch(() => setStatus('تعذّر تشغيل الصوت'));
  playBtn.classList.add('opacity-50');
  sheikhAudio.onended = () => playBtn.classList.remove('opacity-50');
}

// ─── Recording ────────────────────────────────────────────────────────────────
async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  clearResult();
  try {
    const stream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioChunks   = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      await submitAudio();
    };

    mediaRecorder.start(200);
    isRecording = true;
    setRecordingUI(true);
    setStatus('🎙️ جاري التسجيل… اتلُ الآية بوضوح');
  } catch (err) {
    console.error(err);
    setStatus('❌ تعذّر الوصول للميكروفون. تأكد من الإذن في المتصفح.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    isRecording = false;
    setRecordingUI(false);
    showSpinner();
  }
}

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

// ─── Submit Audio ─────────────────────────────────────────────────────────────
async function submitAudio() {
  if (!currentSurah) return;
  const ayah     = currentSurah.ayahs[currentAyahIdx];
  const mimeType = audioChunks[0]?.type || 'audio/webm';
  const rawBlob  = new Blob(audioChunks, { type: mimeType });

  if (rawBlob.size < 1000) {
    setStatus('⚠️ التسجيل قصير جداً. جرّب مرة أخرى.');
    hideSpinner();
    return;
  }

  // تحويل الصوت في المتصفح إلى WAV (16kHz Mono) ليعمل على سيرفر Vercel بدون الحاجة لـ FFmpeg
  let finalBlob = rawBlob;
  let filename = 'recording.webm';
  try {
    finalBlob = await convertBlobToWav(rawBlob);
    filename = 'recording.wav';
  } catch (err) {
    console.warn('Using raw recorded blob:', err);
  }

  const formData = new FormData();
  formData.append('audio',     finalBlob, filename);
  formData.append('ayah_text', ayah.text);

  sessionAttempts++;
  updateStats();

  try {
    const resp = await fetch('/process_audio', { method: 'POST', body: formData });
    const data = await resp.json();
    hideSpinner();

    if (data.error) {
      showResultBadge(false, `❌ ${data.error}`);
      return;
    }

    showAnalysisResult(data);
  } catch (e) {
    hideSpinner();
    setStatus('❌ خطأ في الاتصال بالسيرفر');
    console.error(e);
  }
}

// ─── Show Analysis Result ─────────────────────────────────────────────────────
function showAnalysisResult(data) {
  // Transcribed text
  if (data.transcribed) {
    transcribedSection.classList.remove('hidden');
    transcribedText.textContent = `"${data.transcribed}"`;
  }

  // Word highlighting
  if (data.word_results && data.word_results.length > 0) {
    renderAyah(data.word_results);
  }

  // Match bar
  const pct = data.percentage || 0;
  matchSection.classList.remove('hidden');
  matchPercent.textContent  = `${pct}%`;
  matchBar.style.width      = `${Math.min(pct, 100)}%`;
  matchBar.style.background = pct >= 85
    ? 'linear-gradient(90deg, #059669, #34d399)'
    : pct >= 60
      ? 'linear-gradient(90deg, #d97706, #fbbf24)'
      : 'linear-gradient(90deg, #be123c, #fb7185)';

  if (data.passed) {
    sessionCorrect++;
    showResultBadge(true, data.message || '✅ أحسنت! تلاوة صحيحة');
    setStatus('');
    // Auto-advance after 2.2 seconds
    setTimeout(() => nextAyah(), 2200);
  } else {
    sessionErrors++;
    showResultBadge(false, data.message || '❌ حاول مرة أخرى');
    retryBtn.classList.remove('hidden');
  }

  updateStats();
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function nextAyah() {
  if (!currentSurah) return;
  if (currentAyahIdx < currentSurah.ayahs.length - 1) {
    currentAyahIdx++;
    clearResult();
    renderAyah();
    setStatus('');
  } else {
    showResultBadge(true, '🎉 أتممت السورة! جزاك الله خيراً');
    setStatus('انتهيت من السورة!');
  }
}

function goToAyah(idx) {
  currentAyahIdx = idx;
  clearResult();
  renderAyah();
  setStatus('');
}

// ─── Dots Navigation ──────────────────────────────────────────────────────────
function buildDots() {
  ayahDots.innerHTML = '';
  if (!currentSurah) return;
  currentSurah.ayahs.forEach((_, i) => {
    const dot      = document.createElement('div');
    dot.className  = 'ayah-dot';
    dot.title      = `الآية ${i + 1}`;
    dot.onclick    = () => goToAyah(i);
    ayahDots.appendChild(dot);
  });
}

function updateDots() {
  const dots = ayahDots.querySelectorAll('.ayah-dot');
  dots.forEach((d, i) => {
    d.className = 'ayah-dot';
    if      (i === currentAyahIdx) d.classList.add('active');
    else if (i <  currentAyahIdx) d.classList.add('done');
  });
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function showResultBadge(success, msg) {
  resultBadge.classList.remove('hidden');
  resultBadge.classList.add('flex');
  resultBadge.innerHTML = `
    <span class="result-badge ${success ? 'badge-success' : 'badge-error'}" style="animation:fadeIn 0.4s ease-out">
      ${msg}
    </span>`;
}

function clearResult() {
  resultBadge.classList.add('hidden');
  resultBadge.classList.remove('flex');
  resultBadge.innerHTML = '';
  transcribedSection.classList.add('hidden');
  matchSection.classList.add('hidden');
  retryBtn.classList.add('hidden');
  if (currentSurah) renderAyah();
}

function resetForRetry() {
  clearResult();
  setStatus('جاهز للتسجيل مجدداً…');
}

function setRecordingUI(recording) {
  if (recording) {
    micBtn.classList.add('recording');
    micIcon.classList.add('hidden');
    stopIcon.classList.remove('hidden');
    waveform.classList.remove('hidden');
    waveform.classList.add('flex');
  } else {
    micBtn.classList.remove('recording');
    micIcon.classList.remove('hidden');
    stopIcon.classList.add('hidden');
    waveform.classList.add('hidden');
    waveform.classList.remove('flex');
  }
}

function showSpinner() {
  statusText.innerHTML = '<div class="spinner" style="margin:auto"></div>';
}

function hideSpinner() {
  statusText.innerHTML = '';
  setStatus('');
}

function setStatus(msg) {
  if (!msg) { statusText.textContent = ''; return; }
  statusText.textContent = msg;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  statCorrect.textContent  = sessionCorrect;
  statErrors.textContent   = sessionErrors;
  statAttempts.textContent = sessionAttempts;

  if (sessionAttempts > 0) {
    const pct = Math.round((sessionCorrect / sessionAttempts) * 100);
    sessionScoreEl.textContent = `${pct}%`;
    sessionScoreEl.className   = pct >= 70
      ? 'text-xl font-bold text-emerald-400'
      : 'text-xl font-bold text-amber-400';
  }
}

// ─── Arabic numerals ─────────────────────────────────────────────────────────
function toArabicNum(n) {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// ─── Rotating tips ────────────────────────────────────────────────────────────
let tipIdx = 0;
function rotateTip() {
  if (!tipText) return;
  tipText.style.opacity = '0';
  tipText.style.transition = 'opacity 0.3s';
  setTimeout(() => {
    tipText.textContent      = tips[tipIdx % tips.length];
    tipText.style.opacity    = '1';
    tipText.style.transition = 'opacity 0.5s';
    tipIdx++;
  }, 300);
}

// ─── Floating particles ───────────────────────────────────────────────────────
function createParticles() {
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left              = Math.random() * 100 + 'vw';
    p.style.animationDuration = (8 + Math.random() * 14) + 's';
    p.style.animationDelay    = (Math.random() * 10) + 's';
    p.style.opacity           = (0.2 + Math.random() * 0.4).toString();
    const size = (2 + Math.random() * 3) + 'px';
    p.style.width = p.style.height = size;
    document.body.appendChild(p);
  }
}

// ─── Client-side WAV Converter (For Zero-FFmpeg Serverless Deployment) ────────
async function convertBlobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtxClass) return blob;

  const audioCtx = new AudioCtxClass();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  return encodeAudioBufferToWav(audioBuffer);
}

function encodeAudioBufferToWav(audioBuffer) {
  const targetSampleRate = 16000;
  const channelData = audioBuffer.getChannelData(0);
  const ratio = audioBuffer.sampleRate / targetSampleRate;
  const newLength = Math.round(channelData.length / ratio);
  const samples = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.min(Math.round(i * ratio), channelData.length - 1);
    let s = Math.max(-1, Math.min(1, channelData[srcIndex]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
