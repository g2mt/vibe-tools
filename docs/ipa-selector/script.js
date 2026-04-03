const modeSelect = document.getElementById('mode-select');
const filterCheckbox = document.getElementById('filter-highlighted');
const clearBtn = document.getElementById('clear-highlighted');

const phonemeFile = {
  // Consonants (pulmonic)
  "m": "File:Bilabial_nasal.ogg",
  "ɱ": "File:Labiodental_nasal.ogg",
  "n": "File:Alveolar_nasal.ogg",
  "ɳ": "File:Retroflex_nasal.ogg",
  "ɲ": "File:Palatal_nasal.ogg",
  "ŋ": "File:Velar_nasal.ogg",
  "ɴ": "File:Uvular_nasal.ogg",
  "p": "File:Voiceless_bilabial_plosive.ogg",
  "b": "File:Voiced_bilabial_plosive.ogg",
  "t": "File:Voiceless_alveolar_plosive.ogg",
  "d": "File:Voiced_alveolar_plosive.ogg",
  "ʈ": "File:Voiceless_retroflex_plosive.ogg",
  "ɖ": "File:Voiced_retroflex_plosive.ogg",
  "c": "File:Voiceless_palatal_plosive.ogg",
  "ɟ": "File:Voiced_palatal_plosive.ogg",
  "k": "File:Voiceless_velar_plosive.ogg",
  "g": "File:Voiced_velar_plosive.ogg",
  "q": "File:Voiceless_uvular_plosive.ogg",
  "ɢ": "File:Voiced_uvular_plosive.ogg",
  "ʔ": "File:Glottal_stop.ogg",
  "ɸ": "File:Voiceless_bilabial_fricative.ogg",
  "β": "File:Voiced_bilabial_fricative.ogg",
  "f": "File:Voiceless_labiodental_fricative.ogg",
  "v": "File:Voiced_labiodental_fricative.ogg",
  "θ": "File:Voiceless_dental_fricative.ogg",
  "ð": "File:Voiced_dental_fricative.ogg",
  "s": "File:Voiceless_alveolar_sibilant.ogg",
  "z": "File:Voiced_alveolar_sibilant.ogg",
  "ʃ": "File:Voiceless_postalveolar_fricative.ogg",
  "ʒ": "File:Voiced_postalveolar_fricative.ogg",
  "ʂ": "File:Voiceless_retroflex_sibilant.ogg",
  "ʐ": "File:Voiced_retroflex_sibilant.ogg",
  "ç": "File:Voiceless_palatal_fricative.ogg",
  "ʝ": "File:Voiced_palatal_fricative.ogg",
  "x": "File:Voiceless_velar_fricative.ogg",
  "ɣ": "File:Voiced_velar_fricative.ogg",
  "χ": "File:Voiceless_uvular_fricative.ogg",
  "ʁ": "File:Voiced_uvular_fricative.ogg",
  "ħ": "File:Voiceless_pharyngeal_fricative.ogg",
  "ʕ": "File:Voiced_pharyngeal_fricative.ogg",
  "h": "File:Voiceless_glottal_fricative.ogg",
  "ɦ": "File:Voiced_glottal_fricative.ogg",
  "ʋ": "File:Labiodental_approximant.ogg",
  "ɹ": "File:Alveolar_approximant.ogg",
  "ɻ": "File:Retroflex_approximant.ogg",
  "j": "File:Palatal_approximant.ogg",
  "ɰ": "File:Voiced_velar_approximant.ogg",
  "ʙ": "File:Bilabial_trill.ogg",
  "r": "File:Alveolar_trill.ogg",
  "ʀ": "File:Uvular_trill.ogg",
  "ɾ": "File:Alveolar_tap.ogg",
  "ɽ": "File:Retroflex_flap.ogg",
  "ɬ": "File:Voiceless_alveolar_lateral_fricative.ogg",
  "ɮ": "File:Voiced_alveolar_lateral_fricative.ogg",
  "l": "File:Alveolar_lateral_approximant.ogg",
  "ɭ": "File:Retroflex_lateral_approximant.ogg",
  "ʎ": "File:Palatal_lateral_approximant.ogg",
  "ʟ": "File:Velar_lateral_approximant.ogg",

  // Consonants (non-pulmonic)
  "ʘ": "File:Bilabial_click.ogg",
  "ǀ": "File:Dental_click.ogg",
  "ǃ": "File:Postalveolar_click.ogg",
  "ǂ": "File:Palatoalveolar_click.ogg",
  "ǁ": "File:Alveolar_lateral_click.ogg",
  "ɓ": "File:Voiced_bilabial_implosive.ogg",
  "ɗ": "File:Voiced_alveolar_implosive.ogg",
  "ʄ": "File:Voiced_palatal_implosive.ogg",
  "ɠ": "File:Voiced_velar_implosive.ogg",
  "ʛ": "File:Voiced_uvular_implosive.ogg",
  "pʼ": "File:Bilabial_ejective_plosive.ogg",
  "tʼ": "File:Alveolar_ejective_plosive.ogg",
  "kʼ": "File:Velar_ejective_plosive.ogg",
  "sʼ": "File:Alveolar_ejective_fricative.ogg",

  // Vowels
  "i": "File:Close_front_unrounded_vowel.ogg",
  "y": "File:Close_front_rounded_vowel.ogg",
  "ɨ": "File:Close_central_unrounded_vowel.ogg",
  "ʉ": "File:Close_central_rounded_vowel.ogg",
  "ɯ": "File:Close_back_unrounded_vowel.ogg",
  "u": "File:Close_back_rounded_vowel.ogg",
  "ɪ": "File:Near-close_near-front_unrounded_vowel.ogg",
  "ʏ": "File:Near-close_near-front_rounded_vowel.ogg",
  "ʊ": "File:Near-close_near-back_rounded_vowel.ogg",
  "e": "File:Close-mid_front_unrounded_vowel.ogg",
  "ø": "File:Close-mid_front_rounded_vowel.ogg",
  "ɘ": "File:Close-mid_central_unrounded_vowel.ogg",
  "ɵ": "File:Close-mid_central_rounded_vowel.ogg",
  "ɤ": "File:Close-mid_back_unrounded_vowel.ogg",
  "o": "File:Close-mid_back_rounded_vowel.ogg",
  "ə": "File:Mid-central_vowel.ogg",
  "ɛ": "File:Open-mid_front_unrounded_vowel.ogg",
  "œ": "File:Open-mid_front_rounded_vowel.ogg",
  "ɜ": "File:Open-mid_central_unrounded_vowel.ogg",
  "ɞ": "File:Open-mid_central_rounded_vowel.ogg",
  "ʌ": "File:Open-mid_back_unrounded_vowel.ogg",
  "ɔ": "File:Open-mid_back_rounded_vowel.ogg",
  "æ": "File:Near-open_front_unrounded_vowel.ogg",
  "ɐ": "File:Near-open_central_vowel.ogg",
  "a": "File:Open_front_unrounded_vowel.ogg",
  "ɶ": "File:Open_front_rounded_vowel.ogg",
  "ɑ": "File:Open_back_unrounded_vowel.ogg",
  "ɒ": "File:Open_back_rounded_vowel.ogg"
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
            const fileName = phonemeFile[text];
            if (fileName) {
                const wikiUrl = `https://commons.wikimedia.org/wiki/${fileName}`;
                fetch(wikiUrl)
                    .then(response => response.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const source = doc.querySelector("#file .audio.mw-tmh-player audio source");
                        if (source) {
                            const audioUrl = source.getAttribute("src");
                            const audio = new Audio(audioUrl);
                            audio.play().catch(err => console.error("Playback failed:", err));
                            
                            // Visual feedback for playing
                            anchor.style.color = 'red';
                            setTimeout(() => {
                                anchor.style.color = '';
                            }, 300);
                        } else {
                            console.warn(`Could not find audio source on page for: ${text}`);
                        }
                    })
                    .catch(err => console.error("Fetch failed:", err));
            } else {
                console.warn(`No audio file mapping found for phoneme: ${text}`);
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
