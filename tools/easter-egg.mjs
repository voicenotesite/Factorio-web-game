#!/usr/bin/env node
const date = new Date().toISOString().slice(0, 10);
const msg = 'NOVACTORIO v0.0.0 [Built: ' + date + ']\n--- FACTORY MUST GROW ---\n* Brainfuck: ENABLED\n* Cells: 30000\n* Purpose: art\n* Status: operational\n';

function genBF(str) {
  let code = '';
  let prev = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = str.charCodeAt(i);
    if (cur > 127) continue;
    const diff = cur - prev;
    if (diff > 0) code += '+'.repeat(diff);
    else if (diff < 0) code += '-'.repeat(-diff);
    code += '.';
    prev = cur;
  }
  return code;
}

const bfCode = genBF(msg);

function run(code) {
  const tape = new Uint8Array(30000);
  let ptr = 0, ip = 0, out = '';
  const loopMap = {};
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '[') stack.push(i);
    else if (code[i] === ']') {
      const s = stack.pop();
      loopMap[i] = s;
      loopMap[s] = i;
    }
  }
  while (ip < code.length) {
    const c = code[ip];
    if (c === '>') ptr++;
    else if (c === '<') ptr--;
    else if (c === '+') tape[ptr]++;
    else if (c === '-') tape[ptr]--;
    else if (c === '.') out += String.fromCharCode(tape[ptr]);
    else if (c === ',') tape[ptr] = 0;
    else if (c === '[' && tape[ptr] === 0) ip = loopMap[ip];
    else if (c === ']' && tape[ptr] !== 0) ip = loopMap[ip];
    ip++;
  }
  return out;
}

console.log(run(bfCode));
