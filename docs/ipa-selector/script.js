const modeSelect = document.getElementById('mode-select');
const filterCheckbox = document.getElementById('filter-highlighted');
const clearBtn = document.getElementById('clear-highlighted');

// Mapping of IPA characters to Wikimedia Commons audio URLs
// Based on https://commons.wikimedia.org/wiki/General_phonetics
const phonemeAudio = {
    // Plosives
    'p': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Voiceless_bilabial_plosive.ogg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Voiced_bilabial_plosive.ogg',
    't': 'https://upload.wikimedia.org/wikipedia/commons/0/02/Voiceless_alveolar_plosive.ogg',
    'd': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Voiced_alveolar_plosive.ogg',
    'ʈ': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Voiceless_retroflex_stop.ogg',
    'ɖ': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Voiced_retroflex_stop.ogg',
    'c': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Voiceless_palatal_plosive.ogg',
    'ɟ': 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Voiced_palatal_plosive.ogg',
    'k': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Voiceless_velar_plosive.ogg',
    'ɡ': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Voiced_velar_plosive.ogg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Voiceless_uvular_plosive.ogg',
    'ɢ': 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Voiced_uvular_plosive.ogg',
    'ʔ': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Glottal_stop.ogg',

    // Nasals
    'm': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Bilabial_nasal.ogg',
    'ɱ': 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Labiodental_nasal.ogg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/2/29/Alveolar_nasal.ogg',
    'ɳ': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Retroflex_nasal.ogg',
    'ɲ': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Palatal_nasal.ogg',
    'ŋ': 'https://upload.wikimedia.org/wikipedia/commons/3/39/Velar_nasal.ogg',
    'ɴ': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Uvular_nasal.ogg',

    // Fricatives
    'ɸ': 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Voiceless_bilabial_fricative.ogg',
    'β': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Voiced_bilabial_fricative.ogg',
    'f': 'https://upload.wikimedia.org/wikipedia/commons/3/33/Voiceless_labiodental_fricative.ogg',
    'v': 'https://upload.wikimedia.org/wikipedia/commons/8/85/Voiced_labiodental_fricative.ogg',
    'θ': 'https://upload.wikimedia.org/wikipedia/commons/8/80/Voiceless_dental_fricative.ogg',
    'ð': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Voiced_dental_fricative.ogg',
    's': 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Voiceless_alveolar_sibilant.ogg',
    'z': 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Voiced_alveolar_sibilant.ogg',
    'ʃ': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Voiceless_postalveolar_fricative.ogg',
    'ʒ': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Voiced_postalveolar_fricative.ogg',
    'ʂ': 'https://upload.wikimedia.org/wikipedia/commons/3/35/Voiceless_retroflex_fricative.ogg',
    'ʐ': 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Voiced_retroflex_fricative.ogg',
    'ç': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Voiceless_palatal_fricative.ogg',
    'ʝ': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Voiced_palatal_fricative.ogg',
    'x': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Voiceless_velar_fricative.ogg',
    'ɣ': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Voiced_velar_fricative.ogg',
    'χ': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Voiceless_uvular_fricative.ogg',
    'ʁ': 'https://upload.wikimedia.org/wikipedia/commons/a/af/Voiced_uvular_fricative.ogg',
    'ħ': 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Voiceless_pharyngeal_fricative.ogg',
    'ʕ': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Voiced_pharyngeal_fricative.ogg',
    'h': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Voiceless_glottal_fricative.ogg',
    'ɦ': 'https://upload.wikimedia.org/wikipedia/commons/b/be/Voiced_glottal_fricative.ogg',

    // Vowels
    'i': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Close_front_unrounded_vowel.ogg',
    'y': 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Close_front_rounded_vowel.ogg',
    'ɨ': 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Close_central_unrounded_vowel.ogg',
    'ʉ': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Close_central_rounded_vowel.ogg',
    'ɯ': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Close_back_unrounded_vowel.ogg',
    'u': 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Close_back_rounded_vowel.ogg',
    'ɪ': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Near-close_near-front_unrounded_vowel.ogg',
    'ʏ': 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Near-close_near-front_rounded_vowel.ogg',
    'ʊ': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Near-close_near-back_rounded_vowel.ogg',
    'e': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Close-mid_front_unrounded_vowel.ogg',
    'ø': 'https://upload.wikimedia.org/wikipedia/commons/0/02/Close-mid_front_rounded_vowel.ogg',
    'ɘ': 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Close-mid_central_unrounded_vowel.ogg',
    'ɵ': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Close-mid_central_rounded_vowel.ogg',
    'ɤ': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Close-mid_back_unrounded_vowel.ogg',
    'o': 'https://upload.wikimedia.org/wikipedia/commons/8/84/Close-mid_back_rounded_vowel.ogg',
    'ə': 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Mid-central_vowel.ogg',
    'ɛ': 'https://upload.wikimedia.org/wikipedia/commons/7/71/Open-mid_front_unrounded_vowel.ogg',
    'œ': 'https://upload.wikimedia.org/wikipedia/commons/0/00/Open-mid_front_rounded_vowel.ogg',
    'ɜ': 'https://upload.wikimedia.org/wikipedia/commons/0/01/Open-mid_central_unrounded_vowel.ogg',
    'ɞ': 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Open-mid_central_rounded_vowel.ogg',
    'ʌ': 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Open-mid_back_unrounded_vowel.ogg',
    'ɔ': 'https://upload.wikimedia.org/wikipedia/commons/0/02/Open-mid_back_rounded_vowel.ogg',
    'æ': 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Near-open_front_unrounded_vowel.ogg',
    'ɐ': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Near-open_central_vowel.ogg',
    'a': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Open_front_unrounded_vowel.ogg',
    'ɶ': 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Open_front_rounded_vowel.ogg',
    'ɑ': 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Open_back_unrounded_vowel.ogg',
    'ɒ': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Open_back_rounded_vowel.ogg',

    // Non-pulmonic
    'ʘ': 'https://upload.wikimedia.org/wikipedia/commons/6/68/Bilabial_click.ogg',
    'ǀ': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Dental_click.ogg',
    '!': 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Postalveolar_click.ogg',
    'ǂ': 'https://upload.wikimedia.org/wikipedia/commons/9/97/Palatoalveolar_click.ogg',
    'ǁ': 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Alveolar_lateral_click.ogg',
    'ɓ': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Voiced_bilabial_implosive.ogg',
    'ɗ': 'https://upload.wikimedia.org/wikipedia/commons/0/05/Voiced_alveolar_implosive.ogg',
    'ʄ': 'https://upload.wikimedia.org/wikipedia/commons/5/51/Voiced_palatal_implosive.ogg',
    'ɠ': 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Voiced_velar_implosive.ogg',
    'ʛ': 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Voiced_uvular_implosive.ogg',
    'pʼ': 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Bilabial_ejective_plosive.ogg',
    'tʼ': 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Alveolar_ejective_plosive.ogg',
    'kʼ': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Velar_ejective_plosive.ogg',
    'sʼ': 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Alveolar_ejective_fricative.ogg'
};

document.querySelectorAll('a.phoneme').forEach(anchor => {
    anchor.href = '#';
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = modeSelect.value;
        const text = anchor.textContent.trim();
        
        if (mode === 'copy') {
            navigator.clipboard.writeText(text);
            anchor.style.transform = 'translateY(-5px)';
            setTimeout(() => {
                anchor.style.transform = 'translateY(0)';
            }, 100);
        } else if (mode === 'play') {
            const url = phonemeAudio[text];
            if (url) {
                const audio = new Audio(url);
                audio.play().catch(err => console.error("Playback failed:", err));
                
                // Visual feedback for playing
                anchor.style.color = 'red';
                setTimeout(() => {
                    anchor.style.color = '';
                }, 300);
            } else {
                console.warn(`No audio found for phoneme: ${text}`);
            }
        } else {
            anchor.classList.toggle('highlighted');
        }
    });
});

clearBtn.addEventListener('click', () => {
    document.querySelectorAll('a.phoneme.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });
});

document.querySelectorAll('.copy-table').forEach(btn => {
    btn.addEventListener('click', () => {
        const table = btn.closest('table');
        const hasHighlights = table.querySelector('.highlighted') !== null;
        const filterEnabled = filterCheckbox.checked;
        
        const rows = Array.from(table.querySelectorAll('tr'));
        
        // Determine which columns have highlights
        const highlightedCols = new Set();
        const highlightedRows = new Set();

        if (filterEnabled && hasHighlights) {
            rows.forEach((row, rowIndex) => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                cells.forEach((cell, colIndex) => {
                    if (cell.querySelector('.phoneme.highlighted')) {
                        highlightedRows.add(rowIndex);
                        highlightedCols.add(colIndex);
                    }
                });
            });
        }

        let markdown = "";
        let headerProcessed = false;

        rows.forEach((row, rowIndex) => {
            const isHeader = row.parentElement.tagName === 'THEAD';
            
            // Skip row if filtering and no highlights in this row (and not header)
            if (filterEnabled && hasHighlights && !isHeader && !highlightedRows.has(rowIndex)) {
                return;
            }

            const cells = Array.from(row.querySelectorAll('th, td'));
            let rowData = [];

            cells.forEach((cell, colIndex) => {
                // Skip column if filtering and no highlights in this column (and not first label column)
                if (filterEnabled && hasHighlights && colIndex !== 0 && !highlightedCols.has(colIndex)) {
                    return;
                }

                // Keep headers and first column labels
                if (cell.tagName === 'TH' || cell.classList.contains('row-label')) {
                    rowData.push(cell.textContent.trim());
                    return;
                }

                // Handle phoneme cells
                const phonemes = Array.from(cell.querySelectorAll('.phoneme'));
                if (phonemes.length === 0) {
                    rowData.push(cell.textContent.trim());
                    return;
                }

                const filtered = hasHighlights 
                    ? phonemes.filter(p => p.classList.contains('highlighted'))
                    : phonemes;

                rowData.push(filtered.map(p => p.textContent.trim()).join(' '));
            });

            markdown += "| " + rowData.join(" | ") + " |\n";
            
            if (isHeader && !headerProcessed) {
                markdown += "| " + rowData.map(() => "---").join(" | ") + " |\n";
                headerProcessed = true;
            }
        });

        navigator.clipboard.writeText(markdown);
    });
});
