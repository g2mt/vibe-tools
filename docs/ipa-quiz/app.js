(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let wordIpaMap = {};
  let wordList = [];
  let currentWord = '';
  let currentIpa = '';
  let firstAttempt = true;
  let questionsAnswered = 0;
  let questionsCorrect = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let quizStarted = false;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const loadingScreen = document.getElementById('loading-screen');
  const app = document.getElementById('app');
  const wordDisplay = document.getElementById('word-display');
  const ipaInput = document.getElementById('ipa-input');
  const scoreDisplay = document.getElementById('score-display');
  const timerDisplay = document.getElementById('timer-display');

  // ── Load data ──────────────────────────────────────────────────────────────
  fetch('../../data/en_US_processed.json')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load dictionary.');
      return res.json();
    })
    .then(data => {
      wordIpaMap = data;
      wordList = Object.keys(data);
      loadingScreen.classList.add('hidden');
      app.classList.remove('hidden');
      nextWord();
      startTimer();
    })
    .catch(err => {
      document.querySelector('.loading-content p').textContent =
        'Error loading data: ' + err.message;
    });

  // ── Timer ──────────────────────────────────────────────────────────────────
  function startTimer() {
    timerInterval = setInterval(() => {
      timerSeconds++;
      const mm = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const ss = String(timerSeconds % 60).padStart(2, '0');
      timerDisplay.textContent = `${mm}:${ss}`;
    }, 1000);
  }

  // ── Pick next word ─────────────────────────────────────────────────────────
  function nextWord() {
    const idx = Math.floor(Math.random() * wordList.length);
    currentWord = wordList[idx];
    currentIpa = wordIpaMap[currentWord];
    firstAttempt = true;
    wordDisplay.textContent = currentWord;
    ipaInput.value = '';
    ipaInput.classList.remove('error', 'success');
    ipaInput.focus();
  }

  // ── Update score display ───────────────────────────────────────────────────
  function updateScore() {
    scoreDisplay.textContent = `${questionsCorrect} / ${questionsAnswered}`;
  }

  // ── Show +1 animation ─────────────────────────────────────────────────────
  function showPlusOne() {
    const wrapper = document.querySelector('.input-wrapper');
    // Remove any existing flying-plus
    const old = wrapper.querySelector('.flying-plus');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'flying-plus';
    el.textContent = '+1';
    wrapper.appendChild(el);

    // Remove after animation
    el.addEventListener('animationend', () => el.remove());
  }

  // ── Handle correct answer ──────────────────────────────────────────────────
  function handleCorrect() {
    questionsAnswered++;
    if (firstAttempt) {
      questionsCorrect++;
      showPlusOne();
    }
    updateScore();

    ipaInput.classList.remove('error');
    ipaInput.classList.add('success');

    setTimeout(() => {
      nextWord();
    }, 600);
  }

  // ── Input event: validate on each keystroke ────────────────────────────────
  ipaInput.addEventListener('input', () => {
    const val = ipaInput.value;

    if (val === '') {
      ipaInput.classList.remove('error', 'success');
      return;
    }

    // Check if the current IPA starts with what the user has typed
    if (!currentIpa.startsWith(val)) {
      ipaInput.classList.add('error');
      ipaInput.classList.remove('success');
      firstAttempt = false;
    } else {
      ipaInput.classList.remove('error');
    }

    // Check for exact match
    if (val === currentIpa) {
      handleCorrect();
    }
  });

  // ── IPA button clicks ──────────────────────────────────────────────────────
  document.querySelectorAll('.ipa-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const char = btn.dataset.ipa;
      ipaInput.value += char;
      // Trigger input event manually
      ipaInput.dispatchEvent(new Event('input'));
      ipaInput.focus();
    });
  });

})();
