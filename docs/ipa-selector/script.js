const modeSelect = document.getElementById('mode-select');
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
        
        const rows = Array.from(table.querySelectorAll('tr'));
        let markdown = "";

        rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            let rowData = cells.map((cell, cellIndex) => {
                // Keep headers and first column labels
                if (cell.tagName === 'TH' || cell.classList.contains('row-label')) {
                    return cell.textContent.trim();
                }

                // Handle phoneme cells
                const phonemes = Array.from(cell.querySelectorAll('.phoneme'));
                if (phonemes.length === 0) return cell.textContent.trim();

                const filtered = hasHighlights 
                    ? phonemes.filter(p => p.classList.contains('highlighted'))
                    : phonemes;

                return filtered.map(p => p.textContent.trim()).join(' ');
            });

            markdown += "| " + rowData.join(" | ") + " |\n";
            
            if (rowIndex === 0) {
                markdown += "| " + rowData.map(() => "---").join(" | ") + " |\n";
            }
        });

        navigator.clipboard.writeText(markdown);
    });
});
