// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Tokenise the input string into '[', ']', or word tokens.
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '[') { tokens.push('['); i++; }
    else if (ch === ']') { tokens.push(']'); i++; }
    else if (/\s/.test(ch)) { i++; }
    else {
      let word = '';
      while (i < input.length && !/[\[\]\s]/.test(input[i])) {
        word += input[i++];
      }
      tokens.push(word);
    }
  }
  return tokens;
}

/**
 * Recursive-descent parser.
 * Returns a node: { label, children }
 * where children is an array of nodes or string leaves.
 */
function parseNode(tokens, pos) {
  if (tokens[pos] !== '[') {
    throw new Error(`Expected '[' at token ${pos}, got: ${tokens[pos]}`);
  }
  pos++; // consume '['

  if (pos >= tokens.length || tokens[pos] === '[' || tokens[pos] === ']') {
    throw new Error(`Expected a label after '[' at token ${pos}`);
  }

  const label = tokens[pos++]; // category label, e.g. TP, NP, V, …
  const children = [];

  while (pos < tokens.length && tokens[pos] !== ']') {
    if (tokens[pos] === '[') {
      const { node, pos: newPos } = parseNode(tokens, pos);
      children.push(node);
      pos = newPos;
    } else {
      // bare word leaf
      children.push({ label: tokens[pos], children: [], isLeaf: true });
      pos++;
    }
  }

  if (tokens[pos] !== ']') {
    throw new Error(`Expected ']' to close [${label}]`);
  }
  pos++; // consume ']'

  return { node: { label, children, isLeaf: false }, pos };
}

function parse(input) {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) throw new Error('Input is empty.');
  const { node, pos } = parseNode(tokens, 0);
  if (pos < tokens.length) {
    throw new Error(`Unexpected tokens after position ${pos}: ${tokens.slice(pos).join(' ')}`);
  }
  return node;
}

// ── X-bar analysis ───────────────────────────────────────────────────────────

/**
 * Collect the terminal (leaf) words of a node as a flat array.
 */
function terminals(node) {
  if (node.isLeaf) return [node.label];
  return node.children.flatMap(terminals);
}

/**
 * Wrap a string in a monospace bracket span.
 */
function bracketSpan(text) {
  const span = document.createElement('span');
  span.className = 'bracket';
  span.textContent = `[${text}]`;
  return span;
}

/**
 * Determine the X-bar role of each child of `node`.
 *
 * X-bar heuristics used here:
 *  - The HEAD is the child whose label matches the category of the parent
 *    (possibly with a prime/bar stripped), or the first non-phrasal child.
 *  - A child that appears BEFORE the head and is a full phrase (XP) is the SPECIFIER.
 *  - Children that appear AFTER the head are COMPLEMENTS (first one) or ADJUNCTS (rest),
 *    unless they are intermediate bar-level projections (X') in which case we recurse.
 *
 * For simplicity we treat:
 *   - Labels ending in "'" or "bar" as bar-level (X')
 *   - Labels ending in "P" as phrasal (XP)
 *   - Everything else as a terminal/head
 */
function getXBarRoles(node) {
  const { label, children } = node;

  // Strip primes/bars to get the base category
  const baseOf = lbl => lbl.replace(/'+$/, '').replace(/bar$/i, '').replace(/P$/i, '');
  const isBar  = lbl => /'+$/.test(lbl) || /bar$/i.test(lbl);
  const isPhrase = lbl => /P$/i.test(lbl) && !isBar(lbl);

  const parentBase = baseOf(label);

  let head = null;
  let specifier = null;
  const complements = [];
  const adjuncts = [];

  // Find the head child: label whose base matches parent base, or first non-phrasal
  let headIdx = -1;
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    const cBase = baseOf(c.label);
    if (cBase.toLowerCase() === parentBase.toLowerCase() && !isPhrase(c.label)) {
      headIdx = i;
      break;
    }
  }
  // Fallback: first child that is a leaf or a head-level label
  if (headIdx === -1) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.isLeaf || (!isPhrase(c.label) && !isBar(c.label))) {
        headIdx = i;
        break;
      }
    }
  }
  // Last fallback: first child
  if (headIdx === -1 && children.length > 0) headIdx = 0;

  if (headIdx !== -1) head = children[headIdx];

  // Children before head → specifier (take the first phrasal one, rest are adjuncts)
  const before = children.slice(0, headIdx === -1 ? 0 : headIdx);
  let specSet = false;
  for (const c of before) {
    if (!specSet && (isPhrase(c.label) || c.isLeaf)) {
      specifier = c;
      specSet = true;
    } else {
      adjuncts.push(c);
    }
  }

  // Children after head → complements / adjuncts
  const after = children.slice(headIdx === -1 ? 0 : headIdx + 1);
  let compSet = false;
  for (const c of after) {
    if (!compSet) {
      complements.push(c);
      compSet = true;
    } else {
      adjuncts.push(c);
    }
  }

  return { head, specifier, complements, adjuncts };
}

// ── Collect all constituents ─────────────────────────────────────────────────

function collectConstituents(node, list = []) {
  if (!node.isLeaf) {
    list.push(node);
    for (const child of node.children) {
      collectConstituents(child, list);
    }
  }
  return list;
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderResults(root) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  const constituents = collectConstituents(root);

  for (const node of constituents) {
    const { head, specifier, complements, adjuncts } = getXBarRoles(node);

    const words = terminals(node).join(' ');

    const card = document.createElement('div');
    card.className = 'constituent-card';

    const table = document.createElement('table');

    // Header row: Constituent
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const th = document.createElement('th');
    th.colSpan = 2;
    th.textContent = `Constituent: ${words}`;
    headerRow.appendChild(th);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    const makeRow = (label, nodes) => {
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.textContent = label;
      const tdValue = document.createElement('td');

      if (!nodes || (Array.isArray(nodes) && nodes.length === 0)) {
        tdValue.textContent = '—';
      } else {
        const arr = Array.isArray(nodes) ? nodes : [nodes];
        for (const n of arr) {
          tdValue.appendChild(bracketSpan(terminals(n).join(' ')));
        }
      }

      tr.appendChild(tdLabel);
      tr.appendChild(tdValue);
      return tr;
    };

    tbody.appendChild(makeRow('Head:', head ? [head] : []));
    tbody.appendChild(makeRow('Specifier:', specifier ? [specifier] : []));
    tbody.appendChild(makeRow('Complements:', complements));
    tbody.appendChild(makeRow('Adjuncts:', adjuncts));

    table.appendChild(tbody);
    card.appendChild(table);
    resultsDiv.appendChild(card);
  }
}

// ── Event wiring ─────────────────────────────────────────────────────────────

document.getElementById('parse-btn').addEventListener('click', () => {
  const input = document.getElementById('tree-input').value;
  const errorDiv = document.getElementById('error-msg');
  const resultsDiv = document.getElementById('results');

  errorDiv.textContent = '';
  resultsDiv.innerHTML = '';

  try {
    const root = parse(input);
    renderResults(root);
  } catch (e) {
    errorDiv.textContent = `Error: ${e.message}`;
  }
});
