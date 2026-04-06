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

/**
 * Wrap words in a bracket span for display.
 */
function bracket(node) {
  return `<span class="bracket">[${wordsOf(node)}]</span>`;
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
    head: '--',
    specifier: '--',
    complements: '--',
    adjuncts: '--',
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
      record.head = headInfo ? bracket(headInfo) : '--';
    }

    if (specNodes.length > 0) {
      record.specifier = specNodes.map(bracket).join(', ');
    }

    if (barNodes.length > 0) {
      const barNode = barNodes[0];
      const { complements, adjuncts } = extractComplementsAdjuncts(barNode);
      record.complements = complements.length > 0 ? complements.map(bracket).join(', ') : '--';
      record.adjuncts = adjuncts.length > 0 ? adjuncts.map(bracket).join(', ') : '--';
    }

  } else if (type === 'bar') {
    // X' → X (head) + complements  OR  X' + adjuncts
    const { head: headLabel, bar: barLabel } = barLabelsFromBar(node.category);
    const headNodes = node.children.filter(c => c.category === headLabel || c.isLeaf);
    const barNodes = node.children.filter(c => c.category === barLabel);
    const otherNodes = node.children.filter(c =>
      c.category !== headLabel && !c.isLeaf && c.category !== barLabel
    );

    // head
    const headNode = node.children.find(c => c.category === headLabel);
    if (headNode) {
      // The head's child is the actual word
      const word = headNode.children[0];
      record.head = word ? bracket(word) : bracket(headNode);
    } else if (barNodes.length > 0) {
      // X' → X' + adjunct: head is inherited
      const innerHead = findHeadInBar(barNodes[0]);
      record.head = innerHead ? bracket(innerHead) : '--';
    }

    // complements vs adjuncts
    if (barNodes.length > 0) {
      // adjunction structure: X' → X' YP
      record.adjuncts = otherNodes.map(bracket).join(', ') || '--';
      // recurse for complements
      const { complements } = extractComplementsAdjuncts(barNodes[0]);
      record.complements = complements.length > 0 ? complements.map(bracket).join(', ') : '--';
    } else {
      // base X': complements are non-head children
      const complements = node.children.filter(c => c.category !== headLabel);
      record.complements = complements.length > 0 ? complements.map(bracket).join(', ') : '--';
    }

  } else if (type === 'head') {
    // Head node: its children are the actual words
    const words = node.children;
    record.head = words.length > 0 ? words.map(bracket).join(' ') : bracket(node);
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
function collectAll(node) {
  const records = [];
  function walk(n) {
    if (n.isLeaf) return;
    const rec = analyseNode(n);
    if (rec) records.push(rec);
    n.children.forEach(walk);
  }
  walk(node);
  return records;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderRecords(records) {
  const output = document.getElementById('output-area');
  output.innerHTML = '';

  if (records.length === 0) {
    output.innerHTML = '<p>No constituents found.</p>';
    return;
  }

  records.forEach(rec => {
    const block = document.createElement('div');
    block.className = 'constituent-block';

    block.innerHTML = `
      <div class="constituent-title">Constituent: <span class="bracket">[${rec.constituent}]</span></div>
      <table>
        <tr><th>Type</th><td>${rec.type}</td></tr>
        <tr><th>Head</th><td>${rec.head}</td></tr>
        <tr><th>Specifier</th><td>${rec.specifier}</td></tr>
        <tr><th>Complements</th><td>${rec.complements}</td></tr>
        <tr><th>Adjuncts</th><td>${rec.adjuncts}</td></tr>
      </table>
    `;

    output.appendChild(block);
  });
}

function renderError(msg) {
  const output = document.getElementById('output-area');
  output.innerHTML = `<p class="error">Parse error: ${msg}</p>`;
}

// ── Entry point ──────────────────────────────────────────────────────────────

document.getElementById('parse-btn').addEventListener('click', () => {
  const input = document.getElementById('tree-input').value;
  try {
    const tree = parse(input);
    const records = collectAll(tree);
    renderRecords(records);
  } catch (e) {
    renderError(e.message);
  }
});
