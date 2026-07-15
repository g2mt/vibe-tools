"use strict";

const input    = document.getElementById("num-input");
const bitsArea = document.getElementById("bits-area");
const radios   = document.querySelectorAll("input[name='struct']");
const reprList  = document.getElementById("repr-list");

let currentStruct = "u8";
const autoCheckbox = document.getElementById("auto-struct");

function structValue() { return currentStruct; }

function autoStruct(value, isFloat) {
  if (isFloat) return value.width === 32 ? "f32" : "f64";
  const v = value;
  if (v >= 0n) {
    if (v < 0x100n) return "u8";
    if (v < 0x10000n) return "u16";
    if (v < 0x100000000n) return "u32";
    return "u64";
  } else {
    if (v >= -0x80n) return "i8";
    if (v >= -0x8000n) return "i16";
    if (v >= -0x80000000n) return "i32";
    return "i64";
  }
}

function setStruct(name) {
  currentStruct = name;
  const r = document.querySelector(`input[name="struct"][value="${name}"]`);
  if (r) r.checked = true;
}

// state.value: BigInt (int) or {kind:"float", num:number}
// state.isFloat: bool
let state = { value: null, isFloat: false };

/* ---------- parsing ---------- */
// grammar-based float/int parse. returns { value, isFloat } or null.
//   int   : no "." and no exponent, no suffix
//   float : has "." or exponent; suffix f/F => f32, l/L or none => f64
function parseInput(raw) {
  const text = raw.trim();
  if (!text) return null;

  // hex / octal ints (no float variants here)
  if (/^[+-]?0x[0-9a-f]+$/i.test(text)) return { value: BigInt(text), isFloat: false };
  if (/^[+-]?0o[0-7]+$/i.test(text)) return { value: BigInt(text), isFloat: false };

  // strip suffix
  let m = text.match(/^([+-]?(?:\d+\.\d*|\d+\.|\.\d*|\d+)(?:[eE][+-]?\d+)?)([fFlL]?)$/);
  if (!m) return null;
  let body = m[1];
  const suffix = m[2];
  const hasFrac = body.includes(".");
  const hasExp  = /[eE]/.test(body);

  if (!hasFrac && !hasExp) {
    // no fractional part and no exponent => integer, unless suffix forces float
    if (suffix === "f" || suffix === "F") {
      return { value: { kind: "float", num: parseFloat(body), width: 32 }, isFloat: true };
    }
    return { value: BigInt(body), isFloat: false };
  }

  // float: f/F => f32, l/L or none => f64
  const is32 = suffix === "f" || suffix === "F";
  // canonicalize body so JS parseFloat understands it
  let cleaned = body.replace(/^(\d+)\.$/, "$1.0")
                    .replace(/^\.(\d)/, "0.$1")
                    .replace(/^(\d+\.)$/, "$10");
  if (cleaned === ".") cleaned = "0.0";
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;
  return { value: { kind: "float", num, width: is32 ? 32 : 64 }, isFloat: true };
}

/* ---------- structure info ---------- */
const STRUCT_INFO = {
  u8:  { bytes: 1, signed: false, kind: "int" },
  i8:  { bytes: 1, signed: true,  kind: "int" },
  u16: { bytes: 2, signed: false, kind: "int" },
  i16: { bytes: 2, signed: true,  kind: "int" },
  u32: { bytes: 4, signed: false, kind: "int" },
  i32: { bytes: 4, signed: true,  kind: "int" },
  u64: { bytes: 8, signed: false, kind: "int" },
  i64: { bytes: 8, signed: true,  kind: "int" },
  f32: { bytes: 4, kind: "float", exp: 8,  frac: 23 },
  f64: { bytes: 8, kind: "float", exp: 11, frac: 52 },
};
const WIDTHS = [8, 16, 32, 64];
function structWidth(sel) { return STRUCT_INFO[sel].bytes * 8; }

/* ---------- width from number ---------- */
function widthForValue(value, isFloat) {
  if (isFloat) return value.width;
  const v = value;
  if (v >= 0n) {
    // width from the position of the highest set '1' bit, rounded to nearest power of 2.
    // e.g. highest bit at index 15 => 16-bit.
    const bitLen = v === 0n ? 1 : v.toString(2).length; // == highestBitIndex + 1
    for (const W of WIDTHS) {
      if (bitLen <= W) return W;
    }
    return 64;
  }
  // negative: two's complement fit (needs the sign bit)
  for (const W of WIDTHS) {
    const lo = -(1n << BigInt(W - 1));
    if (v >= lo) return W;
  }
  return 64;
}

function displayWidth() {
  const sw = structWidth(structValue());
  return Math.max(widthForValue(state.value, state.isFloat), sw);
}

/* ---------- bit conversions ---------- */
function valueToBits(value, isFloat, width) {
  const mask = (1n << BigInt(width)) - 1n;
  if (isFloat) {
    return floatToBits(value.num, value.width) & mask; // take low `width` bits
  }
  // two's complement mod 2^width
  return (((value % (1n << BigInt(width))) + (1n << BigInt(width))) % (1n << BigInt(width))) & mask;
}

function floatToBits(num, width) {
  const buf = new ArrayBuffer(width / 8);
  const view = new DataView(buf);
  if (width === 32) view.setFloat32(0, num, false);
  else view.setFloat64(0, num, false);
  let big = 0n;
  for (let i = 0; i < width / 8; i++) big = (big << 8n) | BigInt(view.getUint8(i));
  return big;
}

function bitsToBigInt(bits, width, signed) {
  const mask = (1n << BigInt(width)) - 1n;
  let v = bits & mask;
  if (signed && (v & (1n << BigInt(width - 1)))) v = v - (1n << BigInt(width));
  return v;
}

function bitsToFloat(bits, width) {
  const buf = new ArrayBuffer(width / 8);
  const view = new DataView(buf);
  for (let i = 0; i < width / 8; i++) {
    const shift = BigInt(width - 8 - i * 8);
    view.setUint8(i, Number((bits >> shift) & 0xffn));
  }
  return width === 32 ? view.getFloat32(0, false) : view.getFloat64(0, false);
}

function bigToHexStr(big, width) {
  const mask = (1n << BigInt(width)) - 1n;
  return (big & mask).toString(16).toUpperCase().padStart(width / 4, "0");
}
function bigToOctStr(big, width) {
  const mask = (1n << BigInt(width)) - 1n;
  return (big & mask).toString(8).padStart(Math.ceil(width / 3), "0");
}
function endianBytes(bits, width, little) {
  const bytes = [];
  for (let i = 0; i < width / 8; i++) {
    const shift = BigInt(width - 8 - i * 8);
    bytes.push(Number((bits >> shift) & 0xffn));
  }
  if (little) bytes.reverse();
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

/* ---------- value -> text for input box ---------- */
function valueToText(value, isFloat) {
  if (isFloat) {
    const f = value.num;
    if (Number.isNaN(f)) return "NaN";
    if (!Number.isFinite(f)) return f > 0 ? "Infinity" : "-Infinity";
    if (Object.is(f, -0)) return "-0";
    return String(f);
  }
  return value.toString(10);
}

/* ---------- rendering ---------- */
function render() {
  if (state.value === null) return;
  const width = displayWidth();
  const bits = valueToBits(state.value, state.isFloat, width);

  bitsArea.innerHTML = "";
  const nBytes = width / 8;
  for (let byteNo = nBytes - 1; byteNo >= 0; byteNo--) {
    const group = document.createElement("div");
    group.className = "byte-group";
    for (let i = 7; i >= 0; i--) {
      const bitIdx = byteNo * 8 + i;
      const on = (bits >> BigInt(bitIdx)) & 1n;
      const cell = document.createElement("div");
      cell.className = "bit " + (on ? "one" : "zero");
      const val = document.createElement("span");
      val.className = "bit-val";
      val.textContent = on ? "1" : "0";
      const idx = document.createElement("span");
      idx.className = "bit-idx";
      idx.textContent = bitIdx;
      cell.appendChild(val);
      cell.appendChild(idx);
      cell.dataset.bit = bitIdx;
      cell.addEventListener("click", () => toggleBit(bitIdx));
      group.appendChild(cell);
    }
    bitsArea.appendChild(group);
  }

  highlight(structValue(), width);
  renderRepr(structValue(), width);
}

function toggleBit(bitIdx) {
  const width = displayWidth();
  const bits = valueToBits(state.value, state.isFloat, width);
  const newBits = bits ^ (1n << BigInt(bitIdx));
  if (state.isFloat) {
    state.value = { kind: "float", num: bitsToFloat(newBits, state.value.width), width: state.value.width };
  } else {
    state.value = bitsToBigInt(newBits, width, true);
  }
  // keep input box in sync without re-triggering parse
  input.value = valueToText(state.value, state.isFloat);
  input.classList.remove("invalid");
  render();
}

function highlight(sel, width) {
  for (const c of bitsArea.querySelectorAll(".bit")) {
    c.classList.remove("sign", "exponent", "fraction");
  }
  const info = STRUCT_INFO[sel];
  const sw = structWidth(sel);
  if (info.kind === "int") {
    if (info.signed) {
      const c = bitsArea.querySelector(`.bit[data-bit="${sw - 1}"]`);
      if (c) c.classList.add("sign");
    }
  } else {
    const exp = info.exp, frac = info.frac;
    const c = bitsArea.querySelector(`.bit[data-bit="${sw - 1}"]`);
    if (c) c.classList.add("sign");
    for (let i = 0; i < exp; i++) {
      const e = bitsArea.querySelector(`.bit[data-bit="${sw - 2 - i}"]`);
      if (e) e.classList.add("exponent");
    }
    for (let i = 0; i < frac; i++) {
      const f = bitsArea.querySelector(`.bit[data-bit="${frac - 1 - i}"]`);
      if (f) f.classList.add("fraction");
    }
  }
}

function sep() {
  const el = document.createElement("li");
  el.className = "sep";
  return el;
}

function li(key, val) {
  const el = document.createElement("li");
  const k = document.createElement("span"); k.className = "k"; k.textContent = key;
  const v = document.createElement("span"); v.className = "v"; v.textContent = val;
  el.appendChild(k); el.appendChild(v);
  return el;
}

function renderRepr(sel, width) {
  reprList.innerHTML = "";
  const info = STRUCT_INFO[sel];
  const sw = structWidth(sel);
  // bits interpreted at the struct width (take low sw bits of the display bits)
  const dispBits = valueToBits(state.value, state.isFloat, width);
  const bits = dispBits & ((1n << BigInt(sw)) - 1n);

  if (info.kind === "int") {
    const valBig = bitsToBigInt(bits, sw, info.signed);
    const uBig   = bitsToBigInt(bits, sw, false);
    reprList.appendChild(li("decimal", valBig.toString(10)));
    reprList.appendChild(li("hex", "0x" + bigToHexStr(uBig, sw)));
    reprList.appendChild(li("octal", "0o" + bigToOctStr(uBig, sw)));
    reprList.appendChild(sep());
    reprList.appendChild(li("little endian", endianBytes(bits, sw, true)));
    reprList.appendChild(li("big endian", endianBytes(bits, sw, false)));
  } else {
    const f = bitsToFloat(bits, sw);
    let decStr;
    if (Number.isNaN(f)) decStr = "NaN";
    else if (!Number.isFinite(f)) decStr = f > 0 ? "Infinity" : "-Infinity";
    else if (Object.is(f, -0)) decStr = "-0";
    else decStr = String(f);
    reprList.appendChild(li("decimal (float)", decStr));

    // split into sign / exponent / fraction
    const exp = info.exp, frac = info.frac;
    const signBit = (bits >> BigInt(sw - 1)) & 1n;
    const expField = (bits >> BigInt(frac)) & ((1n << BigInt(exp)) - 1n);
    const fracField = bits & ((1n << BigInt(frac)) - 1n);
    // exponent is stored biased (bias = 2^(exp-1)-1)
    const bias = (1n << BigInt(exp - 1)) - 1n;
    const expVal = expField - bias;
    reprList.appendChild(li("exponent", expVal.toString(10)));
    reprList.appendChild(li("fraction", fracField.toString(10)));

    reprList.appendChild(sep());

    const uBig = bitsToBigInt(bits, sw, false);
    reprList.appendChild(li("decimal (int bits)", uBig.toString(10)));
    reprList.appendChild(li("hex (int bits)", "0x" + bigToHexStr(uBig, sw)));

    reprList.appendChild(sep());

    reprList.appendChild(li("little endian", endianBytes(bits, sw, true)));
    reprList.appendChild(li("big endian", endianBytes(bits, sw, false)));
  }
}

/* ---------- events ---------- */
input.addEventListener("input", () => {
  const parsed = parseInput(input.value);
  if (parsed === null) {
    input.classList.add("invalid");
    return; // keep showing last result as-is
  }
  input.classList.remove("invalid");
  state.value = parsed.value;
  state.isFloat = parsed.isFloat;
  if (autoCheckbox.checked) setStruct(autoStruct(state.value, state.isFloat));
  render();
});

radios.forEach(r => r.addEventListener("change", () => {
  currentStruct = r.value;
  render();
}));

// seed
input.value = "42";
input.dispatchEvent(new Event("input"));
