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

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const loadingScreen = document.getElementById('loading-screen');
  const app = document.getElementById('app');
  const wordDisplay = document.getElementById('word-display');
  const ipaInput = document.getElementById('ipa-input');
  const giveUpBtn = document.getElementById('give-up-btn');
  const altSpellingChk = document.getElementById('alt-spelling-chk');
  const cotCaughtChk = document.getElementById('cot-caught-chk');
  const dictInfo = document.getElementById('dict-info');
  const scoreDisplay = document.getElementById('score-display');
  const timerDisplay = document.getElementById('timer-display');
  const dictSelect = document.getElementById('dict-select');
  const resetScoreBtn = document.getElementById('reset-score-btn');
  const resetTimerBtn = document.getElementById('reset-timer-btn');

  // ── Load data ──────────────────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const dictKey = urlParams.get('dict');
  
  // Set up dictionary mapping
  const dictMap = {
    'cmudict-ipa': 'data/cmudict-ipa/en_US_processed.json',
    'open-dict-data': 'data/open-dict-data/en_US_processed.json'
  };
  
  // Set initial selection based on URL param or default
  const initialDict = dictKey || 'cmudict-ipa';
  dictSelect.value = initialDict;
  
  let dictPath = dictMap[initialDict];

  // ── Load data ──────────────────────────────────────────────────────────────
  function loadData() {
    // Clear previous data
    wordIpaMap = {};
    wordList = [];
    
    // Show loading state
    loadingScreen.classList.remove('hidden');
    app.classList.add('hidden');
    
    fetch(dictPath)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dictionary.');
        return res.json();
      })
      .then(data => {
        wordIpaMap = data;
        wordList = Object.keys(data);
        dictInfo.textContent = `Loaded dictionary: ${dictSelect.value}`;
        loadingScreen.classList.add('hidden');
        app.classList.remove('hidden');
        updateIpaButtons();
        // Reset game state
        questionsAnswered = 0;
        questionsCorrect = 0;
        updateScore();
        nextWord();
        startTimer();
      })
      .catch(err => {
        document.querySelector('.loading-content p').textContent =
          'Error loading data: ' + err.message;
      });
  }
  
  // Initial load
  loadData();
  
  // Handle dictionary selection change
  dictSelect.addEventListener('change', () => {
    const selectedDict = dictSelect.value;
    dictPath = dictMap[selectedDict];
    
    // Update URL without reloading
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('dict', selectedDict);
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);
    
    // Load the new dictionary
    loadData();
  });

  // Reset score button handler
  resetScoreBtn.addEventListener('click', () => {
    questionsAnswered = 0;
    questionsCorrect = 0;
    updateScore();
  });

  // Reset timer button handler
  resetTimerBtn.addEventListener('click', () => {
    timerSeconds = 0;
    timerDisplay.textContent = '00:00';
  });

  // ── Update IPA Buttons visibility ──────────────────────────────────────────
  function updateIpaButtons() {
    const usedChars = new Set();
    for (const ipa of Object.values(wordIpaMap)) {
      for (const char of ipa) {
        usedChars.add(char);
      }
    }

    document.querySelectorAll('.ipa-btn').forEach(btn => {
      const char = btn.dataset.ipa;
      if (usedChars.has(char)) {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    });
  }

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

  // ── Normalization for alternative spellings ────────────────────────────────
  function normalizeIpa(str) {
    let result = str;
    
    if (altSpellingChk.checked) {
      // Replace ɫ with l, and g (U+0067) with ɡ (U+0261)
      result = result.replace(/ɫ/g, 'l').replace(/g/g, 'ɡ');
    }
    
    if (cotCaughtChk.checked) {
      // Treat ɑ and ɔ as the same. Normalize ɑ to ɔ.
      result = result.replace(/ɑ/g, 'ɔ');
    }
    
    return result;
  }

  // ── Input event: validate on each keystroke ────────────────────────────────
  ipaInput.addEventListener('input', () => {
    const val = ipaInput.value;
    const normVal = normalizeIpa(val);
    const normCurrent = normalizeIpa(currentIpa);

    if (val === '') {
      ipaInput.classList.remove('error', 'success');
      return;
    }

    // Check if the current IPA starts with what the user has typed
    if (!normCurrent.startsWith(normVal)) {
      ipaInput.classList.add('error');
      ipaInput.classList.remove('success');
      firstAttempt = false;
    } else {
      ipaInput.classList.remove('error');
    }

    // Check for match
    if (normVal === normCurrent) {
      handleCorrect();
    }
  });

  // ── Give up button ─────────────────────────────────────────────────────────
  giveUpBtn.addEventListener('click', () => {
    firstAttempt = false;
    ipaInput.value = currentIpa;
    ipaInput.dispatchEvent(new Event('input'));
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
