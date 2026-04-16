/**
 * Parse a syntax tree string into a nested array structure.
 * Each node is either a string (leaf) or an array where the first element
 * is the category string and the rest are child nodes.
 */
function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;

  function parseNode() {
    if (tokens[pos] === '[') {
      pos++; // consume '['
      const node = [];
      while (pos < tokens.length && tokens[pos] !== ']') {
        node.push(parseNode());
      }
      pos++; // consume ']'
      return node;
    } else {
      // It's a plain token (string)
      return tokens[pos++];
    }
  }

  const result = parseNode();
  return result;
}

/**
 * Tokenize the input string into brackets and words.
 */
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '[' || ch === ']') {
      tokens.push(ch);
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      let word = '';
      while (i < input.length && !/[\s\[\]]/.test(input[i])) {
        word += input[i];
        i++;
      }
      tokens.push(word);
    }
  }
  return tokens;
}

/**
 * Check if a node is flat (contains no nested lists).
 */
function isFlat(node) {
  if (!Array.isArray(node)) return true;
  return node.every(child => !Array.isArray(child));
}

/**
 * Format a parsed node back into a string with indentation.
 */
function formatNode(node, indent) {
  if (!Array.isArray(node)) {
    return node;
  }

  if (isFlat(node)) {
    // Keep flat lists on one line
    return '[' + node.join(' ') + ']';
  }

  const spaces = ' '.repeat(indent + 2);
  const closingSpaces = ' '.repeat(indent);

  // The first element is the category
  const category = node[0];
  const children = node.slice(1);

  const formattedChildren = children.map(child => {
    if (Array.isArray(child)) {
      return spaces + formatNode(child, indent + 2);
    } else {
      return spaces + child;
    }
  });

  return '[' + category + '\n' + formattedChildren.join('\n') + '\n' + closingSpaces + ']';
}

/**
 * Format the syntax tree string.
 */
function format(input) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const parsed = parse(trimmed);
    return formatNode(parsed, 0);
  } catch (e) {
    alert('Error parsing syntax tree: ' + e.message);
    return input;
  }
}

/**
 * Unformat (collapse) the syntax tree string into a single line.
 */
function unformat(input) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const parsed = parse(trimmed);
    return unformatNode(parsed);
  } catch (e) {
    alert('Error parsing syntax tree: ' + e.message);
    return input;
  }
}

/**
 * Collapse a parsed node into a single-line string.
 */
function unformatNode(node) {
  if (!Array.isArray(node)) {
    return node;
  }
  return '[' + node.map(unformatNode).join(' ') + ']';
}

/**
 * Modify the textarea's text, using execCommand if supported, otherwise falling back to value assignment.
 */
function setTextareaValue(textarea, newText) {
  if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
    textarea.focus();
    textarea.select();
    if (document.execCommand('insertText', false, newText)) {
      return;
    }
  }
  textarea.value = newText;
}

// Wire up buttons
document.getElementById('format-btn').addEventListener('click', () => {
  const textarea = document.getElementById('input');
  setTextareaValue(textarea, format(textarea.value));
});

document.getElementById('unformat-btn').addEventListener('click', () => {
  const textarea = document.getElementById('input');
  setTextareaValue(textarea, unformat(textarea.value));
});

/**
 * Select the syntax tree block enclosing the cursor, including brackets.
 */
function selectEnclosingBrackets(textarea) {
  const text = textarea.value;
  let cursorPos = textarea.selectionStart ?? 0;

  let openPos = -1;
  let balance = 0;
  for (let i = cursorPos; i >= 0; i--) {
    if (text[i] === ']') balance++;
    if (text[i] === '[') {
      balance--;
      if (balance < 0) {
        openPos = i;
        break;
      }
    }
  }

  if (openPos === -1) return;

  let closePos = -1;
  balance = 0;
  for (let i = openPos; i < text.length; i++) {
    if (text[i] === '[') balance++;
    if (text[i] === ']') {
      balance--;
      if (balance === 0) {
        closePos = i;
        break;
      }
    }
  }

  if (closePos === -1) return;

  textarea.setSelectionRange(openPos, closePos + 1);
  textarea.focus();
}

document.getElementById('select-btn').addEventListener('click', () => {
  const textarea = document.getElementById('input');
  selectEnclosingBrackets(textarea);
});

/**
 * Wrap the nearest syntax tree block in a new parent with "X" as the head.
 */
function wrapBlock(textarea) {
  const text = textarea.value;
  let cursorPos = textarea.selectionStart ?? 0;

  let openPos = -1;
  let balance = 0;
  for (let i = cursorPos; i >= 0; i--) {
    if (text[i] === ']') balance++;
    if (text[i] === '[') {
      balance--;
      if (balance < 0) {
        openPos = i;
        break;
      }
    }
  }

  if (openPos === -1) return;

  let closePos = -1;
  balance = 0;
  for (let i = openPos; i < text.length; i++) {
    if (text[i] === '[') balance++;
    if (text[i] === ']') {
      balance--;
      if (balance === 0) {
        closePos = i;
        break;
      }
    }
  }

  if (closePos === -1) return;

  const before = text.substring(0, openPos);
  const inside = text.substring(openPos + 1, closePos);
  const after = text.substring(closePos + 1);

  const wrapped = `[X [${inside}]]`;
  setTextareaValue(textarea, before + wrapped + after);

  // Place cursor after "[X ["
  const newCursorPos = openPos + 4;
  textarea.selectionStart = newCursorPos;
  textarea.selectionEnd = newCursorPos;
  textarea.focus();
}

document.getElementById('wrap-btn').addEventListener('click', () => {
  const textarea = document.getElementById('input');
  wrapBlock(textarea);
});

/**
 * Unwrap the syntax tree block enclosing the cursor by removing its brackets.
 */
function unwrapBlock(textarea) {
  const text = textarea.value;
  let cursorPos = textarea.selectionStart ?? 0;

  let openPos = -1;
  let balance = 0;
  for (let i = cursorPos; i >= 0; i--) {
    if (text[i] === ']') balance++;
    if (text[i] === '[') {
      balance--;
      if (balance < 0) {
        openPos = i;
        break;
      }
    }
  }

  if (openPos === -1) return;

  let closePos = -1;
  balance = 0;
  for (let i = openPos; i < text.length; i++) {
    if (text[i] === '[') balance++;
    if (text[i] === ']') {
      balance--;
      if (balance === 0) {
        closePos = i;
        break;
      }
    }
  }

  if (closePos === -1) return;

  const before = text.substring(0, openPos);
  const inside = text.substring(openPos + 1, closePos);
  const after = text.substring(closePos + 1);

  setTextareaValue(textarea, before + inside + after);

  textarea.selectionStart = openPos;
  textarea.selectionEnd = openPos;
  textarea.focus();
}

document.getElementById('unwrap-btn').addEventListener('click', () => {
  const textarea = document.getElementById('input');
  unwrapBlock(textarea);
});

/**
 * Indent or dedent the selected lines, or the current line if no selection.
 * Mimics Vim's > and < commands.
 */
function shiftLines(textarea, direction) {
  const text = textarea.value;
  let start = textarea.selectionStart;
  let end = textarea.selectionEnd;

  // If no selection, target the current line
  if (start === end) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    start = lineStart;
    end = lineEnd === -1 ? text.length : lineEnd;
  } else {
    // Expand selection to cover full lines
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;
    start = lineStart;
    end = lineEnd;
  }

  const before = text.substring(0, start);
  const selected = text.substring(start, end);
  const after = text.substring(end);

  const lines = selected.split('\n');
  const shiftedLines = lines.map(line => {
    if (direction > 0) {
      return '  ' + line;
    } else {
      return line.replace(/^ {1,2}/, '');
    }
  });

  const newText = shiftedLines.join('\n');
  const newLength = newText.length;

  setTextareaValue(textarea, before + newText + after);
  setTimeout(() => {
    textarea.selectionStart = start;
    textarea.selectionEnd = start + newLength;
    textarea.focus();
  }, 0);
}

document.getElementById('indent-btn').addEventListener('click', () => {
  shiftLines(document.getElementById('input'), 1);
});

document.getElementById('dedent-btn').addEventListener('click', () => {
  shiftLines(document.getElementById('input'), -1);
});

document.getElementById('copy-unformatted-btn').addEventListener('click', async () => {
  const textarea = document.getElementById('input');
  const unformatted = unformat(textarea.value);
  try {
    await navigator.clipboard.writeText(unformatted);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
});
