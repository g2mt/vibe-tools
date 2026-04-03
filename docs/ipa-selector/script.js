const modeSelect = document.getElementById('mode-select');
const filterCheckbox = document.getElementById('filter-highlighted');
const clearBtn = document.getElementById('clear-highlighted');

// Mapping of IPA characters to Wikimedia Commons audio URLs
// Based on https://commons.wikimedia.org/wiki/General_phonetics
const phonemeAudio = {
  // Consonants (pulmonic)
  "m": "https://commons.wikimedia.org/wiki/File:Bilabial_nasal.ogg",
  "ɱ": "https://commons.wikimedia.org/wiki/File:Labiodental_nasal.ogg",
  "n": "https://commons.wikimedia.org/wiki/File:Alveolar_nasal.ogg",
  "ɳ": "https://commons.wikimedia.org/wiki/File:Retroflex_nasal.ogg",
  "ɲ": "https://commons.wikimedia.org/wiki/File:Palatal_nasal.ogg",
  "ŋ": "https://commons.wikimedia.org/wiki/File:Velar_nasal.ogg",
  "ɴ": "https://commons.wikimedia.org/wiki/File:Uvular_nasal.ogg",
  "p": "https://commons.wikimedia.org/wiki/File:Voiceless_bilabial_plosive.ogg",
  "b": "https://commons.wikimedia.org/wiki/File:Voiced_bilabial_plosive.ogg",
  "t": "https://commons.wikimedia.org/wiki/File:Voiceless_alveolar_plosive.ogg",
  "d": "https://commons.wikimedia.org/wiki/File:Voiced_alveolar_plosive.ogg",
  "ʈ": "https://commons.wikimedia.org/wiki/File:Voiceless_retroflex_plosive.ogg",
  "ɖ": "https://commons.wikimedia.org/wiki/File:Voiced_retroflex_plosive.ogg",
  "c": "https://commons.wikimedia.org/wiki/File:Voiceless_palatal_plosive.ogg",
  "ɟ": "https://commons.wikimedia.org/wiki/File:Voiced_palatal_plosive.ogg",
  "k": "https://commons.wikimedia.org/wiki/File:Voiceless_velar_plosive.ogg",
  "g": "https://commons.wikimedia.org/wiki/File:Voiced_velar_plosive.ogg",
  "q": "https://commons.wikimedia.org/wiki/File:Voiceless_uvular_plosive.ogg",
  "ɢ": "https://commons.wikimedia.org/wiki/File:Voiced_uvular_plosive.ogg",
  "ʔ": "https://commons.wikimedia.org/wiki/File:Glottal_stop.ogg",
  "ɸ": "https://commons.wikimedia.org/wiki/File:Voiceless_bilabial_fricative.ogg",
  "β": "https://commons.wikimedia.org/wiki/File:Voiced_bilabial_fricative.ogg",
  "f": "https://commons.wikimedia.org/wiki/File:Voiceless_labiodental_fricative.ogg",
  "v": "https://commons.wikimedia.org/wiki/File:Voiced_labiodental_fricative.ogg",
  "θ": "https://commons.wikimedia.org/wiki/File:Voiceless_dental_fricative.ogg",
  "ð": "https://commons.wikimedia.org/wiki/File:Voiced_dental_fricative.ogg",
  "s": "https://commons.wikimedia.org/wiki/File:Voiceless_alveolar_sibilant.ogg",
  "z": "https://commons.wikimedia.org/wiki/File:Voiced_alveolar_sibilant.ogg",
  "ʃ": "https://commons.wikimedia.org/wiki/File:Voiceless_postalveolar_fricative.ogg",
  "ʒ": "https://commons.wikimedia.org/wiki/File:Voiced_postalveolar_fricative.ogg",
  "ʂ": "https://commons.wikimedia.org/wiki/File:Voiceless_retroflex_sibilant.ogg",
  "ʐ": "https://commons.wikimedia.org/wiki/File:Voiced_retroflex_sibilant.ogg",
  "ç": "https://commons.wikimedia.org/wiki/File:Voiceless_palatal_fricative.ogg",
  "ʝ": "https://commons.wikimedia.org/wiki/File:Voiced_palatal_fricative.ogg",
  "x": "https://commons.wikimedia.org/wiki/File:Voiceless_velar_fricative.ogg",
  "ɣ": "https://commons.wikimedia.org/wiki/File:Voiced_velar_fricative.ogg",
  "χ": "https://commons.wikimedia.org/wiki/File:Voiceless_uvular_fricative.ogg",
  "ʁ": "https://commons.wikimedia.org/wiki/File:Voiced_uvular_fricative.ogg",
  "ħ": "https://commons.wikimedia.org/wiki/File:Voiceless_pharyngeal_fricative.ogg",
  "ʕ": "https://commons.wikimedia.org/wiki/File:Voiced_pharyngeal_fricative.ogg",
  "h": "https://commons.wikimedia.org/wiki/File:Voiceless_glottal_fricative.ogg",
  "ɦ": "https://commons.wikimedia.org/wiki/File:Voiced_glottal_fricative.ogg",
  "ʋ": "https://commons.wikimedia.org/wiki/File:Labiodental_approximant.ogg",
  "ɹ": "https://commons.wikimedia.org/wiki/File:Alveolar_approximant.ogg",
  "ɻ": "https://commons.wikimedia.org/wiki/File:Retroflex_approximant.ogg",
  "j": "https://commons.wikimedia.org/wiki/File:Palatal_approximant.ogg",
  "ɰ": "https://commons.wikimedia.org/wiki/File:Voiced_velar_approximant.ogg",
  "ʙ": "https://commons.wikimedia.org/wiki/File:Bilabial_trill.ogg",
  "r": "https://commons.wikimedia.org/wiki/File:Alveolar_trill.ogg",
  "ʀ": "https://commons.wikimedia.org/wiki/File:Uvular_trill.ogg",
  "ɾ": "https://commons.wikimedia.org/wiki/File:Alveolar_tap.ogg",
  "ɽ": "https://commons.wikimedia.org/wiki/File:Retroflex_flap.ogg",
  "ɬ": "https://commons.wikimedia.org/wiki/File:Voiceless_alveolar_lateral_fricative.ogg",
  "ɮ": "https://commons.wikimedia.org/wiki/File:Voiced_alveolar_lateral_fricative.ogg",
  "l": "https://commons.wikimedia.org/wiki/File:Alveolar_lateral_approximant.ogg",
  "ɭ": "https://commons.wikimedia.org/wiki/File:Retroflex_lateral_approximant.ogg",
  "ʎ": "https://commons.wikimedia.org/wiki/File:Palatal_lateral_approximant.ogg",
  "ʟ": "https://commons.wikimedia.org/wiki/File:Velar_lateral_approximant.ogg",

  // Consonants (non-pulmonic)
  "ʘ": "https://commons.wikimedia.org/wiki/File:Bilabial_click.ogg",
  "ǀ": "https://commons.wikimedia.org/wiki/File:Dental_click.ogg",
  "ǃ": "https://commons.wikimedia.org/wiki/File:Postalveolar_click.ogg",
  "ǂ": "https://commons.wikimedia.org/wiki/File:Palatoalveolar_click.ogg",
  "ǁ": "https://commons.wikimedia.org/wiki/File:Alveolar_lateral_click.ogg",
  "ɓ": "https://commons.wikimedia.org/wiki/File:Voiced_bilabial_implosive.ogg",
  "ɗ": "https://commons.wikimedia.org/wiki/File:Voiced_alveolar_implosive.ogg",
  "ʄ": "https://commons.wikimedia.org/wiki/File:Voiced_palatal_implosive.ogg",
  "ɠ": "https://commons.wikimedia.org/wiki/File:Voiced_velar_implosive.ogg",
  "ʛ": "https://commons.wikimedia.org/wiki/File:Voiced_uvular_implosive.ogg",
  "pʼ": "https://commons.wikimedia.org/wiki/File:Bilabial_ejective_plosive.ogg",
  "tʼ": "https://commons.wikimedia.org/wiki/File:Alveolar_ejective_plosive.ogg",
  "kʼ": "https://commons.wikimedia.org/wiki/File:Velar_ejective_plosive.ogg",
  "sʼ": "https://commons.wikimedia.org/wiki/File:Alveolar_ejective_fricative.ogg",

  // Vowels
  "i": "https://commons.wikimedia.org/wiki/File:Close_front_unrounded_vowel.ogg",
  "y": "https://commons.wikimedia.org/wiki/File:Close_front_rounded_vowel.ogg",
  "ɨ": "https://commons.wikimedia.org/wiki/File:Close_central_unrounded_vowel.ogg",
  "ʉ": "https://commons.wikimedia.org/wiki/File:Close_central_rounded_vowel.ogg",
  "ɯ": "https://commons.wikimedia.org/wiki/File:Close_back_unrounded_vowel.ogg",
  "u": "https://commons.wikimedia.org/wiki/File:Close_back_rounded_vowel.ogg",
  "ɪ": "https://commons.wikimedia.org/wiki/File:Near-close_near-front_unrounded_vowel.ogg",
  "ʏ": "https://commons.wikimedia.org/wiki/File:Near-close_near-front_rounded_vowel.ogg",
  "ʊ": "https://commons.wikimedia.org/wiki/File:Near-close_near-back_rounded_vowel.ogg",
  "e": "https://commons.wikimedia.org/wiki/File:Close-mid_front_unrounded_vowel.ogg",
  "ø": "https://commons.wikimedia.org/wiki/File:Close-mid_front_rounded_vowel.ogg",
  "ɘ": "https://commons.wikimedia.org/wiki/File:Close-mid_central_unrounded_vowel.ogg",
  "ɵ": "https://commons.wikimedia.org/wiki/File:Close-mid_central_rounded_vowel.ogg",
  "ɤ": "https://commons.wikimedia.org/wiki/File:Close-mid_back_unrounded_vowel.ogg",
  "o": "https://commons.wikimedia.org/wiki/File:Close-mid_back_rounded_vowel.ogg",
  "ə": "https://commons.wikimedia.org/wiki/File:Mid-central_vowel.ogg",
  "ɛ": "https://commons.wikimedia.org/wiki/File:Open-mid_front_unrounded_vowel.ogg",
  "œ": "https://commons.wikimedia.org/wiki/File:Open-mid_front_rounded_vowel.ogg",
  "ɜ": "https://commons.wikimedia.org/wiki/File:Open-mid_central_unrounded_vowel.ogg",
  "ɞ": "https://commons.wikimedia.org/wiki/File:Open-mid_central_rounded_vowel.ogg",
  "ʌ": "https://commons.wikimedia.org/wiki/File:Open-mid_back_unrounded_vowel.ogg",
  "ɔ": "https://commons.wikimedia.org/wiki/File:Open-mid_back_rounded_vowel.ogg",
  "æ": "https://commons.wikimedia.org/wiki/File:Near-open_front_unrounded_vowel.ogg",
  "ɐ": "https://commons.wikimedia.org/wiki/File:Near-open_central_vowel.ogg",
  "a": "https://commons.wikimedia.org/wiki/File:Open_front_unrounded_vowel.ogg",
  "ɶ": "https://commons.wikimedia.org/wiki/File:Open_front_rounded_vowel.ogg",
  "ɑ": "https://commons.wikimedia.org/wiki/File:Open_back_unrounded_vowel.ogg",
  "ɒ": "https://commons.wikimedia.org/wiki/File:Open_back_rounded_vowel.ogg"
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
