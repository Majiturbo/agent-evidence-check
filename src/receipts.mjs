/**
 * Per-repo session receipts for direction / loop gates.
 * Lives at <repo>/.deploy-check/session.json (gitignored). Not a transcript.
 */

import fs from 'node:fs';
import path from 'node:path';

const DIR = '.deploy-check';
const FILE = 'session.json';

export function receiptDir(root) {
  return path.join(root, DIR);
}

export function receiptPath(root) {
  return path.join(receiptDir(root), FILE);
}

export function emptyReceipts(sessionId = 'default') {
  return {
    sessionId: String(sessionId || 'default'),
    direction: null,
    loop: null,
    done: null,
    edits: {},
    editTotal: 0,
    lastEditAt: null,
  };
}

export function loadReceipts(root, sessionId = 'default') {
  const file = receiptPath(root);
  const sid = String(sessionId || 'default');
  if (!fs.existsSync(file)) return emptyReceipts(sid);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyReceipts(sid);
    if (raw.sessionId && raw.sessionId !== sid) return emptyReceipts(sid);
    return {
      sessionId: sid,
      direction: raw.direction && typeof raw.direction === 'object' ? raw.direction : null,
      loop: raw.loop && typeof raw.loop === 'object' ? raw.loop : null,
      done: raw.done && typeof raw.done === 'object' ? raw.done : null,
      edits: raw.edits && typeof raw.edits === 'object' ? raw.edits : {},
      editTotal: Number(raw.editTotal) || 0,
      lastEditAt: raw.lastEditAt || null,
    };
  } catch {
    return emptyReceipts(sid);
  }
}

export function saveReceipts(root, data) {
  fs.mkdirSync(receiptDir(root), { recursive: true });
  const ignore = path.join(receiptDir(root), '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  fs.writeFileSync(receiptPath(root), JSON.stringify(data, null, 2) + '\n');
}

export function noteDirection(root, { sessionId, moment } = {}) {
  const data = loadReceipts(root, sessionId);
  data.direction = { ok: true, at: new Date().toISOString(), moment: moment || null };
  saveReceipts(root, data);
  return data;
}

export function noteLoop(root, { sessionId, target } = {}) {
  const data = loadReceipts(root, sessionId);
  data.loop = { ok: true, at: new Date().toISOString(), target: target || null };
  // Clear per-file counters so editGate unlocks. Keep editTotal/lastEditAt so
  // doneGate can still require a green receipt after the same edit burst.
  data.edits = {};
  saveReceipts(root, data);
  return data;
}

export function noteDone(root, { sessionId, testCommand, exitCode } = {}) {
  const data = loadReceipts(root, sessionId);
  data.done = {
    ok: true,
    at: new Date().toISOString(),
    testCommand: testCommand || null,
    exitCode: exitCode == null ? null : Number(exitCode),
  };
  saveReceipts(root, data);
  return data;
}

export function noteEdit(root, { sessionId, file } = {}) {
  const data = loadReceipts(root, sessionId);
  const key = normalizeFile(file) || '_unknown';
  data.edits[key] = (data.edits[key] || 0) + 1;
  data.editTotal = (data.editTotal || 0) + 1;
  data.lastEditAt = new Date().toISOString();
  saveReceipts(root, data);
  return data;
}

function normalizeFile(file) {
  const s = String(file || '').trim().replace(/\\/g, '/');
  if (!s) return '';
  return s.replace(/^\.\//, '');
}

/**
 * @returns {{ block: boolean, kind?: 'direction'|'loop'|'done', detail?: object }}
 */
export function evaluateStopGate(receipts, opts = {}) {
  const stopOn = Boolean(opts.enabled);
  const doneOn = Boolean(opts.doneEnabled);
  if (!stopOn && !doneOn) return { block: false };
  if (opts.stopHookActive) return { block: false };
  if (Number(opts.loopCount) >= Number(opts.loopLimit || 3)) return { block: false };
  const minEdits = Number(opts.minEdits) || 3;
  const editTotal = Number(receipts?.editTotal) || 0;
  if (editTotal < 1) return { block: false };

  if (stopOn && !receipts?.direction?.ok) {
    return { block: true, kind: 'direction', detail: { editTotal } };
  }

  if (stopOn) {
    const loopOk = Boolean(receipts?.loop?.ok);
    const loopAfterEdits =
      loopOk && receipts.loop.at && receipts.lastEditAt && receipts.loop.at >= receipts.lastEditAt;
    if (editTotal >= minEdits && !loopAfterEdits) {
      return { block: true, kind: 'loop', detail: { editTotal, minEdits } };
    }
  }

  if (doneOn) {
    const doneOk = Boolean(receipts?.done?.ok);
    const doneAfterEdits =
      doneOk && receipts.done.at && receipts.lastEditAt && receipts.done.at >= receipts.lastEditAt;
    if (!doneAfterEdits) {
      return { block: true, kind: 'done', detail: { editTotal } };
    }
  }
  return { block: false };
}

/**
 * @returns {{ block: boolean, count?: number, minEdits?: number }}
 */
export function evaluateEditGate(receipts, opts = {}) {
  if (!opts.enabled) return { block: false };
  const minEdits = Number(opts.minEdits) || 3;
  const key = normalizeFile(opts.file) || '_unknown';
  const count = Number(receipts?.edits?.[key]) || 0;
  // count is before this edit is applied by caller — gate after noteEdit
  if (count < minEdits) return { block: false };
  const loopOk = Boolean(receipts?.loop?.ok);
  const loopAfter =
    loopOk && receipts.loop.at && receipts.lastEditAt && receipts.loop.at >= receipts.lastEditAt;
  if (loopAfter) return { block: false };
  return { block: true, count, minEdits, file: key };
}
