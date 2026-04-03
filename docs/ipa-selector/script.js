const modeSelect = document.getElementById('mode-select');
const filterCheckbox = document.getElementById('filter-highlighted');
const clearBtn = document.getElementById('clear-highlighted');

document.querySelectorAll('a.phoneme').forEach(anchor => {
    anchor.href = '#';
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (modeSelect.value === 'copy') {
            const text = anchor.textContent;
            navigator.clipboard.writeText(text);

            anchor.style.transform = 'translateY(-5px)';
            setTimeout(() => {
                anchor.style.transform = 'translateY(0)';
            }, 100);
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
