// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Tokenise the input string into '[', ']', or word tokens.
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }
    if (input[i] === '[') { tokens.push('['); i++; continue; }
    if (input[i] === ']') { tokens.push(']'); i++; continue; }
    // word
    let word = '';
    while (i < input.length && !/[\s\[\]]/.test(input[i])) {
      word += input[i++];
    }
    tokens.push(word);
  }
  return tokens;
}

/**
 * Parse tokens into a tree node.
 * Node: { category, children: [] }
 * A child is either a node (phrase/head) or a string (bare word, shouldn't appear in well-formed trees).
 */
function parseTokens(tokens, pos) {
  if (tokens[pos] !== '[') throw new Error(`Expected '[' at position ${pos}, got '${tokens[pos]}'`);
  pos++; // consume '['

  if (pos >= tokens.length) throw new Error('Unexpected end of input after [');

  const category = tokens[pos++]; // e.g. TP, T', V, NP …

  const children = [];
  while (pos < tokens.length && tokens[pos] !== ']') {
    if (tokens[pos] === '[') {
      const result = parseTokens(tokens, pos);
      children.push(result.node);
      pos = result.pos;
    } else {
      // bare word child (leaf word)
      children.push({ category: tokens[pos++], children: [], isLeaf: true });
    }
  }

  if (tokens[pos] !== ']') throw new Error('Missing closing ]');
  pos++; // consume ']'

  return { node: { category, children, isLeaf: false }, pos };
}

function parse(input) {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new Error('Empty input');
  const { node, pos } = parseTokens(tokens, 0);
  if (pos !== tokens.length) throw new Error('Unexpected tokens after root node');
  return node;
}

// ── X-bar helpers ────────────────────────────────────────────────────────────

/**
 * Given a category string, return its type:
 *   'phrase'  – ends with P  (TP, NP, VP, DP …)
 *   'bar'     – ends with '  (T', N', V' …)
 *   'head'    – anything else (T, N, V, D …)
 *   'leaf'    – isLeaf node (actual word)
 */
function nodeType(node) {
  if (node.isLeaf) return 'leaf';
  const cat = node.category;
  if (cat.endsWith('P')) return 'phrase';
  if (cat.endsWith("'")) return 'bar';
  return 'head';
}

/**
 * For a phrase XP, return the expected bar label X' and head label X.
 */
function phraseLabels(category) {
  const base = category.slice(0, -1); // remove trailing P
  return { bar: base + "'", head: base };
}

/**
 * Collect all words (leaves) under a node as a flat string.
 */
function wordsOf(node) {
  if (node.isLeaf) return node.category;
  return node.children.map(wordsOf).join(' ');
}

// ── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Analyse a single node according to X-bar schema and return a record object.
 * Returns null for leaf nodes (individual words).
 */
function analyseNode(node) {
  const type = nodeType(node);
  if (type === 'leaf') return null;

  const record = {
    constituent: wordsOf(node),
    type: node.category,
    warning: null,
    head: null,
    specifier: [],
    complements: [],
    adjuncts: [],
  };

  if (type === 'phrase') {
    // XP → specifier + X'
    const { bar } = phraseLabels(node.category);
    const barNodes = node.children.filter(c => c.category === bar);
    const specNodes = node.children.filter(c => c.category !== bar);

    if (barNodes.length > 0) {
      // Recurse into the bar level to find the head
      const barNode = barNodes[0];
      const headInfo = findHeadInBar(barNode);
      record.head = headInfo ? wordsOf(headInfo) : null;

      if (specNodes.length > 0) {
        record.specifier = specNodes.map(wordsOf);
      }

      const { complements, adjuncts } = extractComplementsAdjuncts(barNode);
      record.complements = complements.map(wordsOf);
      record.adjuncts = adjuncts.map(wordsOf);
    } else {
      // No bar level (e.g. [DP [D a] [NP ...]])
      record.warning = `Missing bar level (${phraseLabels(node.category).bar})`;
      // Treat children as head + complements
      const { head: headLabel } = phraseLabels(node.category);
      const headNode = node.children.find(c => c.category === headLabel);
      if (headNode) {
        const word = headNode.children[0];
        record.head = word ? wordsOf(word) : wordsOf(headNode);
      }
      const complements = node.children.filter(c => c.category !== headLabel);
      record.complements = complements.map(wordsOf);
    }

  } else if (type === 'bar') {
    // X' → X (head) + complements  OR  X' + adjuncts
    const { head: headLabel, bar: barLabel } = barLabelsFromBar(node.category);
    const barNodes = node.children.filter(c => c.category === barLabel);
    const otherNodes = node.children.filter(c =>
      c.category !== headLabel && !c.isLeaf && c.category !== barLabel
    );

    // head
    const headNode = node.children.find(c => c.category === headLabel);
    if (headNode) {
      // The head's child is the actual word
      const word = headNode.children[0];
      record.head = word ? wordsOf(word) : wordsOf(headNode);
    } else if (barNodes.length > 0) {
      // X' → X' + adjunct: head is inherited
      const innerHead = findHeadInBar(barNodes[0]);
      record.head = innerHead ? wordsOf(innerHead) : null;
    }

    // complements vs adjuncts
    if (barNodes.length > 0) {
      // adjunction structure: X' → X' YP
      record.adjuncts = otherNodes.map(wordsOf);
      // recurse for complements
      const { complements } = extractComplementsAdjuncts(barNodes[0]);
      record.complements = complements.map(wordsOf);
    } else {
      // base X': complements are non-head children
      const complements = node.children.filter(c => c.category !== headLabel);
      record.complements = complements.map(wordsOf);
    }

  } else if (type === 'head') {
    // Head node: its children are the actual words
    const words = node.children;
    record.head = words.length > 0 ? words.map(wordsOf).join(' ') : wordsOf(node);
  }

  return record;
}

/**
 * Given a bar category like "T'", return { head: "T", bar: "T'" }.
 */
function barLabelsFromBar(category) {
  const base = category.slice(0, -1); // remove trailing '
  return { head: base, bar: category };
}

/**
 * Find the head word node inside a bar node (recursively through bar levels).
 */
function findHeadInBar(barNode) {
  if (barNode.isLeaf) return barNode;
  const { head: headLabel, bar: barLabel } = barLabelsFromBar(barNode.category);
  const headNode = barNode.children.find(c => c.category === headLabel);
  if (headNode) {
    return headNode.children[0] || headNode;
  }
  const innerBar = barNode.children.find(c => c.category === barLabel);
  if (innerBar) return findHeadInBar(innerBar);
  return null;
}

/**
 * Extract complements and adjuncts from a bar node.
 * Base X': complements = non-head children.
 * Adjunction X' → X' YP: adjuncts = YP siblings of inner X'.
 */
function extractComplementsAdjuncts(barNode) {
  const { head: headLabel, bar: barLabel } = barLabelsFromBar(barNode.category);
  const innerBar = barNode.children.find(c => c.category === barLabel);

  if (innerBar) {
    // adjunction level
    const adjuncts = barNode.children.filter(c => c.category !== barLabel);
    const { complements, adjuncts: innerAdj } = extractComplementsAdjuncts(innerBar);
    return { complements, adjuncts: [...adjuncts, ...innerAdj] };
  } else {
    // base level
    const complements = barNode.children.filter(c => c.category !== headLabel && !c.isLeaf);
    return { complements, adjuncts: [] };
  }
}

/**
 * Walk the entire tree and collect analysis records for every non-leaf node.
 */
function collectAll(node, phraseOnly, hideWords) {
  const records = [];
  function walk(n) {
    if (n.isLeaf) return;
    
    const type = nodeType(n);
    let skip = false;
    if (phraseOnly && type !== 'phrase') skip = true;
    if (hideWords && type === 'head') skip = true;

    if (!skip) {
      const rec = analyseNode(n);
      if (rec) records.push(rec);
    }
    
    n.children.forEach(walk);
  }
  walk(node);
  return records;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function createBracketSpan(text) {
  const span = document.createElement('span');
  span.className = 'bracket';
  span.textContent = `[${text}]`;
  return span;
}

function renderRecords(records) {
  const output = document.getElementById('output-area');
  output.innerHTML = '';

  if (records.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No constituents found.';
    output.appendChild(p);
    return;
  }

  records.forEach(rec => {
    const block = document.createElement('div');
    block.className = 'constituent-block';

    const title = document.createElement('div');
    title.className = 'constituent-title';
    title.textContent = 'Constituent: ';
    title.appendChild(createBracketSpan(rec.constituent));
    block.appendChild(title);

    if (rec.warning) {
      const warnDiv = document.createElement('div');
      warnDiv.className = 'error';
      warnDiv.textContent = `Warning: ${rec.warning}`;
      block.appendChild(warnDiv);
    }

    const table = document.createElement('table');
    const rows = [
      ['Type', rec.type],
      ['Head', rec.head],
      ['Specifier', rec.specifier],
      ['Complements', rec.complements],
      ['Adjuncts', rec.adjuncts]
    ];

    rows.forEach(([label, value]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = label;
      const td = document.createElement('td');

      if (label === 'Type') {
        td.textContent = value;
      } else if (value === null || (Array.isArray(value) && value.length === 0)) {
        td.textContent = '--';
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          td.appendChild(createBracketSpan(item));
          if (idx < value.length - 1) {
            td.appendChild(document.createTextNode(', '));
          }
        });
      } else {
        td.appendChild(createBracketSpan(value));
      }

      tr.appendChild(th);
      tr.appendChild(td);
      table.appendChild(tr);
    });

    block.appendChild(table);
    output.appendChild(block);
  });
}

function renderError(msg) {
  const output = document.getElementById('output-area');
  output.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = `Parse error: ${msg}`;
  output.appendChild(p);
}

// ── Entry point ──────────────────────────────────────────────────────────────

document.getElementById('parse-btn').addEventListener('click', () => {
  let input = document.getElementById('tree-input').value;
  input = input.replaceAll("’", "'");
  const phraseOnly = document.getElementById('phrase-only-check').checked;
  const hideWords = document.getElementById('hide-words-check').checked;
  
  try {
    const tree = parse(input);
    const records = collectAll(tree, phraseOnly, hideWords);
    renderRecords(records);
  } catch (e) {
    renderError(e.message);
  }
});
