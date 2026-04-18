const englishPhonemes = [
    'p', 'b', 't', 'd', 'k', 'ɡ', 'm', 'n', 'ŋ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'w', 'ɹ', 'j', 'l',
    'a', 'ɑ', 'æ', 'ə', 'ʌ', 'ɛ', 'e', 'i', 'ɪ', 'o', 'ɔ', 'u', 'ʊ', 'ɜ'
];

let score = 0;
const total = englishPhonemes.length;
let startTime = Date.now();

const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const bankItems = document.getElementById('bank-items');
const dropZones = document.querySelectorAll('.drop-zone');

function updateScore() {
    scoreDisplay.textContent = `${score} / ${total}`;
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerDisplay.textContent = `${mins}:${secs}`;
}

function init() {
    // Setup drop zones
    dropZones.forEach(zone => {
        const ipa = zone.dataset.ipa;
        if (!englishPhonemes.includes(ipa)) {
            zone.classList.add('not-english');
        } else {
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('over'));
            zone.addEventListener('drop', e => {
                e.preventDefault();
                zone.classList.remove('over');
                const draggedIpa = e.dataTransfer.getData('text/plain');
                
                if (draggedIpa === ipa && !zone.classList.contains('filled')) {
                    zone.textContent = ipa;
                    zone.classList.add('filled');
                    score++;
                    updateScore();
                    removePhonemeFromBank(ipa);
                    if (score === total) {
                        alert('Congratulations! You completed the chart.');
                    }
                }
            });
        }
    });

    // Setup bank
    const shuffled = [...englishPhonemes].sort(() => Math.random() - 0.5);
    shuffled.forEach(ipa => {
        const card = document.createElement('div');
        card.className = 'phoneme-card';
        card.draggable = true;
        card.textContent = ipa;
        card.dataset.ipa = ipa;
        
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', ipa);
            card.classList.add('dragging');
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        
        bankItems.appendChild(card);
    });

    updateScore();
    setInterval(updateTimer, 1000);
}

function removePhonemeFromBank(ipa) {
    const cards = bankItems.querySelectorAll('.phoneme-card');
    for (const card of cards) {
        if (card.dataset.ipa === ipa) {
            card.remove();
            break;
        }
    }
}

init();
