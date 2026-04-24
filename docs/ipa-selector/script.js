const modeSelect = document.getElementById('mode-select');
const filterCheckbox = document.getElementById('filter-highlighted');
const clearBtn = document.getElementById('clear-highlighted');

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
                const title = fileName.replace('File:', '');
                const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json&origin=*`;

                fetch(apiUrl)
                    .then(response => response.json())
                    .then(data => {
                        const pages = data.query.pages;
                        const pageId = Object.keys(pages)[0];
                        if (pageId !== "-1" && pages[pageId].imageinfo) {
                            const audioUrl = pages[pageId].imageinfo[0].url;
                            const audio = new Audio(audioUrl);
                            audio.play().catch(err => console.error("Playback failed:", err));

                            // Visual feedback for playing
                            anchor.style.color = 'red';
                            setTimeout(() => {
                                anchor.style.color = '';
                            }, 300);
                        } else {
                            console.warn(`Could not find audio URL via API for: ${text}`);
                        }
                    })
                    .catch(err => console.error("API Fetch failed:", err));
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

function prepareTable(table) {
    const clone = table.cloneNode(true);
    clone.querySelectorAll('.copy-table').forEach(el => el.remove());
    return clone;
}

function getNormalizedGrid(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    let maxCols = 0;

    rows.forEach(row => {
        let count = 0;
        row.querySelectorAll('th, td').forEach(cell => {
            count += parseInt(cell.colSpan) || 1;
        });
        maxCols = Math.max(maxCols, count);
    });

    return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const expanded = [];

        cells.forEach(cell => {
            const colspan = parseInt(cell.colSpan) || 1;
            cell.removeAttribute('colspan');
            expanded.push(cell);
            for (let i = 1; i < colspan; i++) {
                expanded.push(cell.cloneNode(true));
            }
        });

        while (expanded.length < maxCols) {
            const filler = document.createElement('td');
            expanded.push(filler);
        }
        while (expanded.length > maxCols) {
            expanded.pop();
        }

        return {
            isHeader: row.parentElement.tagName === 'THEAD',
            cells: expanded
        };
    });
}

function getHighlightedSets(grid) {
    const highlightedRows = new Set();
    const highlightedCols = new Set();

    grid.forEach((row, rowIndex) => {
        row.cells.forEach((cell, colIndex) => {
            if (cell.querySelector('.phoneme.highlighted')) {
                highlightedRows.add(rowIndex);
                highlightedCols.add(colIndex);
            }
        });
    });

    return { highlightedRows, highlightedCols };
}

function tableToMarkdown(table, filterEnabled, hasHighlights) {
    const clone = prepareTable(table);
    const grid = getNormalizedGrid(clone);
    const { highlightedRows, highlightedCols } = getHighlightedSets(grid);

    let markdown = "";
    let headerProcessed = false;

    grid.forEach((row, rowIndex) => {
        if (filterEnabled && hasHighlights && !row.isHeader && !highlightedRows.has(rowIndex)) {
            return;
        }

        const rowData = [];

        row.cells.forEach((cell, colIndex) => {
            if (filterEnabled && hasHighlights && colIndex !== 0 && !highlightedCols.has(colIndex)) {
                return;
            }

            if (cell.tagName === 'TH' || cell.classList.contains('row-label')) {
                rowData.push(cell.textContent.trim());
                return;
            }

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

        if (row.isHeader && !headerProcessed) {
            markdown += "| " + rowData.map(() => "---").join(" | ") + " |\n";
            headerProcessed = true;
        }
    });

    return markdown;
}

function buildCleanTable(table, filterEnabled, hasHighlights) {
    const clone = prepareTable(table);
    const grid = getNormalizedGrid(clone);
    const { highlightedRows, highlightedCols } = getHighlightedSets(grid);

    const newTable = document.createElement('table');
    let headerProcessed = false;

    grid.forEach((row, rowIndex) => {
        if (filterEnabled && hasHighlights && !row.isHeader && !highlightedRows.has(rowIndex)) {
            return;
        }

        const newRow = document.createElement('tr');

        row.cells.forEach((cell, colIndex) => {
            if (filterEnabled && hasHighlights && colIndex !== 0 && !highlightedCols.has(colIndex)) {
                return;
            }

            const newCell = document.createElement(cell.tagName);
            if (cell.classList.contains('row-label')) {
                newCell.className = 'row-label';
            }

            const phonemes = Array.from(cell.querySelectorAll('.phoneme'));
            if (phonemes.length === 0) {
                newCell.textContent = cell.textContent.trim();
            } else {
                const filtered = hasHighlights
                    ? phonemes.filter(p => p.classList.contains('highlighted'))
                    : phonemes;

                filtered.forEach((p, idx) => {
                    if (idx > 0) newCell.appendChild(document.createTextNode(' '));
                    const span = document.createElement('span');
                    span.textContent = p.textContent.trim();
                    newCell.appendChild(span);
                });
            }

            newRow.appendChild(newCell);
        });

        if (row.isHeader && !headerProcessed) {
            const thead = document.createElement('thead');
            thead.appendChild(newRow);
            newTable.appendChild(thead);
            headerProcessed = true;
        } else {
            let tbody = newTable.querySelector('tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                newTable.appendChild(tbody);
            }
            tbody.appendChild(newRow);
        }
    });

    return newTable;
}

function tableToHTML(table, filterEnabled, hasHighlights) {
    return buildCleanTable(table, filterEnabled, hasHighlights).outerHTML;
}

function copyRichText(table, filterEnabled, hasHighlights) {
    const cleanTable = buildCleanTable(table, filterEnabled, hasHighlights);
    const html = cleanTable.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const item = new ClipboardItem({ 'text/html': blob });
    navigator.clipboard.write([item]);
}

document.querySelectorAll('.copy-table').forEach(container => {
    const table = container.closest('table');

    const mdBtn = document.createElement('button');
    mdBtn.textContent = 'Md';
    mdBtn.addEventListener('click', () => {
        const hasHighlights = table.querySelector('.highlighted') !== null;
        const filterEnabled = filterCheckbox.checked;
        const markdown = tableToMarkdown(table, filterEnabled, hasHighlights);
        navigator.clipboard.writeText(markdown);
    });

    const htmlBtn = document.createElement('button');
    htmlBtn.textContent = 'HTML';
    htmlBtn.addEventListener('click', () => {
        const hasHighlights = table.querySelector('.highlighted') !== null;
        const filterEnabled = filterCheckbox.checked;
        const html = tableToHTML(table, filterEnabled, hasHighlights);
        navigator.clipboard.writeText(html);
    });

    const richBtn = document.createElement('button');
    richBtn.textContent = 'Rich';
    richBtn.addEventListener('click', () => {
        const hasHighlights = table.querySelector('.highlighted') !== null;
        const filterEnabled = filterCheckbox.checked;
        copyRichText(table, filterEnabled, hasHighlights);
    });

    container.appendChild(mdBtn);
    container.appendChild(htmlBtn);
    container.appendChild(richBtn);
});
