export function createTapEmitter() {
  let testCount = 0;
  const lines = [];
  function header(planned) {
    lines.push('TAP version 13');
    if (planned != null) lines.push(`1..${planned}`);
  }
  function ok(name) {
    testCount += 1;
    lines.push(`ok ${testCount} ${name}`);
  }
  function okWithNote(name, note) {
    testCount += 1;
    lines.push(`ok ${testCount} ${name}`);
    if (note) {
      lines.push('  ---');
      lines.push(`  note: ${note}`);
      lines.push('  ...');
    }
  }
  function notOk(name, diag) {
    testCount += 1;
    lines.push(`not ok ${testCount} ${name}`);
    if (diag) {
      lines.push('  ---');
      for (const [k, v] of Object.entries(diag)) {
        lines.push(`  ${k}: ${String(v)}`);
      }
      lines.push('  ...');
    }
  }
  function plan(n) { lines.push(`1..${n}`); }
  function toString() { return lines.join('\n') + '\n'; }
  return { header, ok, okWithNote, notOk, plan, toString, get count() { return testCount; } };
}

