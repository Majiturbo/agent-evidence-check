/**
 * User-facing strings. English is the default; Chinese via `"lang": "zh"` in deploy-units.json
 * or DEPLOY_CHECK_LANG=zh. GUI-launched hosts often have no LANG, so env sniffing is only a fallback.
 */

const en = {
  evidence: 'Evidence',
  forbidden: 'Forbidden',
  note: 'Note (optional)',
  andMore: (n) => `…${n} total`,

  'dirty_tree.title': 'Working tree must be clean',
  'dirty_tree.premise': 'The working tree can be cleared before deploying',
  'dirty_tree.message':
    'The working tree has uncommitted changes, possibly unfinished work from another agent or session. Do not clear it with stash/checkout. Commit or move the changes yourself, or deploy an explicit pushed SHA instead.',
  'dirty_tree.forbidden': [
    'git stash (push / -u) to clear the tree before deploying',
    'git checkout -- <file> / git restore to discard uncommitted changes',
    'git reset --hard',
    'git clean -f',
  ],
  'dirty_tree.opt.commit_or_move': ['I will commit or move these changes', 'Deploy after that'],
  'dirty_tree.opt.deploy_sha': ['Deploy an explicit pushed SHA instead', 'Leave the working tree alone'],
  'dirty_tree.opt.worktree': ['Use a separate git worktree', 'One directory per agent avoids collisions'],

  'deploy_from_commit.title': 'Deploy an explicit commit SHA',
  'deploy_from_commit.empty.premise': 'Deploying straight from the working tree is fine',
  'deploy_from_commit.empty.evidence': 'event.commit is empty',
  'deploy_from_commit.empty.message':
    'The deploy source must be an explicit git SHA, not the working tree. Commit, push, then deploy that SHA.',
  'deploy_from_commit.head.premise': 'HEAD / the working tree is a valid deploy source',
  'deploy_from_commit.head.message': 'Resolve to a full SHA first so HEAD cannot move between check and deploy.',
  'deploy_from_commit.bad.premise': 'The given commit reference is valid',
  'deploy_from_commit.bad.evidence': (ref) => `cannot resolve: ${ref}`,
  'deploy_from_commit.bad.message': 'The commit reference does not resolve to a git object.',
  'deploy_from_commit.opt.provide_sha': ['Provide the SHA to deploy'],
  'deploy_from_commit.opt.resolve_sha': ['Resolve and pin the full SHA'],
  'deploy_from_commit.opt.fix_ref': ['Fix the reference and retry'],

  'unpushed.title': 'Commit must be pushed',
  'unpushed.premise': 'A local commit is enough to deploy',
  'unpushed.evidence': (sha) => `${sha} is not on any remote-tracking branch`,
  'unpushed.message':
    'The commit to deploy is not on a remote yet. Push first; otherwise other agents and CI cannot see the same version.',
  'unpushed.opt.push': ['git push, then deploy'],

  'units_declared.title': 'Deploy units must be declared',
  'units_declared.badid.premise': 'The deploy-units config is valid',
  'units_declared.badid.evidence': (n) => `${n} unit(s) missing an id`,
  'units_declared.badid.message': 'Every unit in deploy-units.json needs a unique id.',
  'units_declared.empty.premise': '"Live" can be claimed without declaring units',
  'units_declared.empty.evidence': 'config.units is empty',
  'units_declared.empty.message':
    'This repo declares no deploy units (e.g. api_image, admin_static). Without a list, "everything is live" cannot be verified. Add units before deploying.',
  'units_declared.opt.fix_config': ['Fix the config'],
  'units_declared.opt.add_units': ['Add deploy-units.json', 'See examples/deploy-units.example.json'],

  'units_match.title': 'Every deploy unit is on the target version',
  'units_match.premise': '"Deployed" means every unit is on the target version',
  'units_match.unobserved': (id) => `${id}: not observed (maybe never deployed)`,
  'units_match.notarget': (id) => `${id}: no target version to compare`,
  'units_match.mismatch': (id, expect, got) => `${id}: expected ${expect}, got ${got}`,
  'units_match.message':
    'Some deploy units are unverified or mismatched. Do not say "live". Deploy the missing units, or narrow the claim to the units that actually shipped.',
  'units_match.opt.redeploy_missing': ['Deploy the mismatched units'],
  'units_match.opt.narrow_claim': ['Narrow the "live" claim and list the units'],
  'units_match.opt.abort': ['Roll back / stop'],

  'hotpatch_drift.title': 'Hot patches must go back to git',
  'hotpatch_drift.premise': 'Production equals some git commit',
  'hotpatch_drift.message':
    'Production has changes that are not in git (hot patches). Commit and push them, or the next deploy will silently overwrite them or the drift will grow.',
  'hotpatch_drift.opt.commit_hotpatch': ['Commit the hot patch to git and push'],
  'hotpatch_drift.opt.revert_hotpatch': ['Drop the hot patch and return to the released commit'],
  'hotpatch_drift.opt.ack': ['Acknowledged, handle later'],

  'opt.abort': ['Cancel this deploy'],

  'hook.ok': 'Pre-deploy checks passed',
  'hook.clear_dirty':
    'This git command would clear the working tree, which has uncommitted changes (possibly another agent or session). Do not stash/checkout/reset/clean them away.',
  'hook.clear_clean':
    'This git command clears the working tree. It is clean now, so nothing is lost, but deploys should not depend on clearing; deploy from a pushed SHA.',
  'hook.not_enrolled': 'deploy-check: no deploy-units.json in this repo (not enrolled)',
  'hook.not_shell': 'deploy-check: not a shell command',
  'hook.unrecognized': 'deploy-check: unrecognized hook payload',
  'hook.blocked': 'deploy-check blocked',
  'hook.header': (mode) => `Deploy check (${mode})`,

  'observe.manual': 'No machine observe spec — supply evidence with --observed or add an observe block',
  'observe.empty': 'observe returned an empty value',
  'observe.manual_pending': (ids) =>
    `Manual units still need evidence: ${ids.join(', ')}. Pass --observed '{"id":"fingerprint"}' or add observe { type, … } to each unit.`,

  'direction_review.title': 'Direction needs a nearer path on the record',
  'direction_review.premise': 'Continuing the current path is justified without writing down another one',
  'direction_review.message':
    'At the start of a task, or when the task turns, write the goal, the path you are on, a different nearer path, why you are or are not taking it, and one fact. Do not keep going on the old path until that record exists.',
  'direction_review.forbidden': [
    'Continue the current path before a different nearer path is written down',
    'Name the current path again and call it the alternative',
  ],
  'direction_review.gap.moment': 'moment must be start or turn',
  'direction_review.gap.goal': 'goal is missing',
  'direction_review.gap.path': 'current path is missing',
  'direction_review.gap.nearer': 'nearer path is missing',
  'direction_review.gap.same': 'nearer path is the same as the current path',
  'direction_review.gap.why': 'why you are or are not taking the nearer path is missing',
  'direction_review.gap.evidence': 'a fact (file, constraint, or user sentence) is missing',
  'direction_review.opt.switch': ['Take the nearer path', 'Stop the current path and do that instead'],
  'direction_review.opt.record': ['Stay, and write why the nearer path loses', 'The reason has to be a fact, not "keep going"'],
  'direction_review.opt.stop': ['Stop and ask which path to take'],

  'loop_escape.title': 'Leave the approach class that is already failing',
  'loop_escape.premise': 'Another edit in the same approach class will fix it',
  'loop_escape.message':
    'This attempt is repeating one approach class. Do not say it is fixed. Name a different class and take that next, or narrow the claim, or stop and ask.',
  'loop_escape.evidence': (target, edits, rejections, tried, claimsFixed) =>
    `target ${target}; edits ${edits}; user rejections ${rejections}; tried "${tried}"; about to claim fixed: ${claimsFixed ? 'yes' : 'no'}`,
  'loop_escape.forbidden': [
    'Say "fixed" / "done" while the next step stays in the same approach class',
    'Apply another tweak inside the class already tried',
  ],
  'loop_escape.opt.switch': ['Switch approach class', 'The next step must be one of the alternatives you name'],
  'loop_escape.opt.narrow': ['Narrow the claim', 'Say what is still broken instead of "fixed"'],
  'loop_escape.opt.stop': ['Stop and ask which class to try'],

  'gate.direction':
    'deploy-check: call deploy_check_direction (or `deploy-check direction`) before continuing. You edited files without a direction receipt for this session.',
  'gate.loop':
    'deploy-check: call deploy_check_loop (or `deploy-check loop`) before finishing. Edit count reached the threshold without a successful loop receipt after those edits.',
  'gate.edit': (file, count, min) =>
    `deploy-check: ${file} edited ${count} times (≥ ${min}). Call deploy_check_loop with a different approach class before more edits.`,
  'gate.done':
    'deploy-check: call deploy_check_done (or `deploy-check done`) before finishing. Edits need a green, untampered test receipt.',

  'done_evidence.premise': 'Saying done is fine without a green test run on the record',
  'done_evidence.message':
    'Before saying done / fixed / green, run the configured tests and keep exit code 0 on the record. Do not claim success from a washed suite.',
  'done_evidence.forbidden': [
    'Say "done" / "tests pass" / "fixed" without a recorded exit code 0',
    'Treat a missing test command as success',
  ],
  'done_evidence.gap.command': 'test command is missing (set done.testCommand or pass --command)',
  'done_evidence.gap.exit': 'test exit code is missing',
  'done_evidence.gap.nonzero': (code) => `test exited ${code} (want 0)`,
  'done_evidence.opt.rerun': ['Run the tests and call done again'],
  'done_evidence.opt.narrow': ['Narrow the claim', 'Say what still fails'],
  'done_evidence.opt.stop': ['Stop and ask'],

  'tests_untampered.premise': 'Making the suite green by deleting or hollowing tests is fine',
  'tests_untampered.message':
    'The uncommitted diff looks like testwashing (deleted tests or skip / assert-true lines). Restore the tests and fix the code, or do not claim done.',
  'tests_untampered.forbidden': [
    'Delete failing tests to go green',
    'Add skip / assert True / expect(true) to silence failures',
  ],
  'tests_untampered.deleted': (list) => `deleted test paths: ${list}`,
  'tests_untampered.washed': (lines) => `suspicious added lines:\n${lines}`,
  'tests_untampered.opt.restore': ['Restore the tests'],
  'tests_untampered.opt.fix_code': ['Fix the code under test'],
  'tests_untampered.opt.stop': ['Stop and ask'],
};

const zh = {
  evidence: '证据',
  forbidden: '禁止',
  note: '补充说明（可选）',
  andMore: (n) => `…共 ${n} 条`,

  'dirty_tree.title': '工作区必须干净',
  'dirty_tree.premise': '工作区可以清场后部署',
  'dirty_tree.message':
    '工作区有未提交改动，其中可能包含另一工具或会话未提交的工作。禁止 stash / checkout 清场；请确认后自行提交、移走，或改从已推送的 SHA 部署。',
  'dirty_tree.forbidden': [
    'git stash（含 push / -u）用于部署前清场',
    'git checkout -- <file> / git restore 丢弃未提交改动',
    'git reset --hard',
    'git clean -f',
  ],
  'dirty_tree.opt.commit_or_move': ['我来提交或移走这些改动', '处理完后再部署'],
  'dirty_tree.opt.deploy_sha': ['改为部署已推送的明确 SHA', '不碰当前工作区'],
  'dirty_tree.opt.worktree': ['改用独立 worktree', '各工具各目录，从根上避免互踩'],

  'deploy_from_commit.title': '必须指定提交 SHA',
  'deploy_from_commit.empty.premise': '可以从当前工作区直接部署',
  'deploy_from_commit.empty.evidence': 'event.commit 为空',
  'deploy_from_commit.empty.message': '部署源必须是明确的 git SHA。不要部署「当前工作区」；先提交并推送，再带上 SHA。',
  'deploy_from_commit.head.premise': 'HEAD / 工作区可以作为部署源',
  'deploy_from_commit.head.message': '请解析成完整 SHA 再部署，避免 HEAD 在检查后被新提交挪走。',
  'deploy_from_commit.bad.premise': '给出的提交引用有效',
  'deploy_from_commit.bad.evidence': (ref) => `无法解析: ${ref}`,
  'deploy_from_commit.bad.message': '提交引用无法解析为 git 对象。',
  'deploy_from_commit.opt.provide_sha': ['补上要部署的 SHA'],
  'deploy_from_commit.opt.resolve_sha': ['解析并钉死完整 SHA'],
  'deploy_from_commit.opt.fix_ref': ['改正引用后再试'],

  'unpushed.title': '提交必须已推送',
  'unpushed.premise': '本地有提交就可以部署',
  'unpushed.evidence': (sha) => `${sha} 不在任何远程跟踪分支上`,
  'unpushed.message': '要部署的提交尚未推送到远程。先 push，再部署；否则其他工具和 CI 对不上同一版本。',
  'unpushed.opt.push': ['先 git push，再部署'],

  'units_declared.title': '必须声明部署单元',
  'units_declared.badid.premise': '部署单元配置合法',
  'units_declared.badid.evidence': (n) => `${n} 个单元缺少 id`,
  'units_declared.badid.message': 'deploy-units 配置里每个单元都需要唯一 id。',
  'units_declared.empty.premise': '不声明单元也能声称已上线',
  'units_declared.empty.evidence': 'config.units 为空',
  'units_declared.empty.message':
    '本仓库尚未声明部署单元（例如 api_image、admin_static）。没有清单就无法证明「全部上线」。请添加配置后再部署。',
  'units_declared.opt.fix_config': ['修正配置'],
  'units_declared.opt.add_units': ['添加 deploy-units 配置', '参见 examples/deploy-units.example.json'],

  'units_match.title': '每个部署单元版本一致',
  'units_match.premise': '部署了 = 所有单元都已是目标版本',
  'units_match.unobserved': (id) => `${id}: 未观测（可能根本没部署这一单元）`,
  'units_match.notarget': (id) => `${id}: 无目标版本可对照`,
  'units_match.mismatch': (id, expect, got) => `${id}: 期望 ${expect}，实际 ${got}`,
  'units_match.message':
    '存在未核验或不匹配的部署单元。禁止说「已上线」。补发缺失单元，或把目标改成实际已发出的版本并说清范围。',
  'units_match.opt.redeploy_missing': ['补发未匹配的单元'],
  'units_match.opt.narrow_claim': ['收窄「已上线」的范围并写明单元清单'],
  'units_match.opt.abort': ['回滚 / 停止'],

  'hotpatch_drift.title': '热修必须回到 git',
  'hotpatch_drift.premise': '线上状态等于某次 git 提交',
  'hotpatch_drift.message': '线上存在与 git 树不一致的改动（热修）。请补提交并推送，否则下次部署会静默覆盖或漂移继续扩大。',
  'hotpatch_drift.opt.commit_hotpatch': ['把热修补回 git 并推送'],
  'hotpatch_drift.opt.revert_hotpatch': ['去掉热修，恢复到已发布提交'],
  'hotpatch_drift.opt.ack': ['已知晓，稍后再处理'],

  'opt.abort': ['取消本次部署'],

  'hook.ok': '部署前检查通过',
  'hook.clear_dirty': '这条 git 命令会清场；工作区有未提交改动（可能属于另一个工具或会话），禁止用 stash/checkout/reset/clean 清掉。',
  'hook.clear_clean': '这条 git 命令会清场。当前工作区干净，不会丢改动；但部署流程不应依赖清场，请从已推送 SHA 部署。',
  'hook.not_enrolled': 'deploy-check：本仓库没有 deploy-units.json（未启用）',
  'hook.not_shell': 'deploy-check：不是 shell 命令',
  'hook.unrecognized': 'deploy-check：无法识别的钩子输入',
  'hook.blocked': 'deploy-check 已拦截',
  'hook.header': (mode) => `部署核对（${mode}）`,

  'observe.manual': '没有可自动观测的配置——请用 --observed 提供证据，或给单元加上 observe 块',
  'observe.empty': '观测结果为空',
  'observe.manual_pending': (ids) =>
    `以下单元仍需人工证据：${ids.join('、')}。请传 --observed '{"id":"指纹"}'，或为每个单元添加 observe { type, … }。`,

  'direction_review.title': '方向必须写下一条更近的路',
  'direction_review.premise': '不写下另一条路，也可以继续走当前这条',
  'direction_review.message':
    '任务开头或中途转折时，写下目标、当前路径、一条不同的更近路径、为何走或不走它、以及一条事实。这条记录写完之前，不要沿旧路径继续。',
  'direction_review.forbidden': ['在写下一条不同的更近路径之前，继续当前路径', '把当前路径换个说法再当成替代方案'],
  'direction_review.gap.moment': 'moment 必须是 start 或 turn',
  'direction_review.gap.goal': '缺少目标',
  'direction_review.gap.path': '缺少当前路径',
  'direction_review.gap.nearer': '缺少更近的路径',
  'direction_review.gap.same': '更近的路径和当前路径相同',
  'direction_review.gap.why': '缺少为何走或不走更近路径的说明',
  'direction_review.gap.evidence': '缺少一条事实（文件、约束或用户原话）',
  'direction_review.opt.switch': ['改走更近的路径', '停掉当前路径，去做那条'],
  'direction_review.opt.record': ['留下，并写明更近的路径为何不取', '理由必须是事实，不能是「继续做」'],
  'direction_review.opt.stop': ['停下来，问该走哪条'],

  'loop_escape.title': '离开已经失败的做法类别',
  'loop_escape.premise': '在同一类做法上再改一次就能修好',
  'loop_escape.message': '这次尝试在重复同一类做法。不要说已经改好。下一步换成另一个类别，或收窄说法，或停下来问。',
  'loop_escape.evidence': (target, edits, rejections, tried, claimsFixed) =>
    `对象 ${target}；修改 ${edits} 次；用户否定 ${rejections} 次；已尝试「${tried}」；正要声称已修好：${claimsFixed ? '是' : '否'}`,
  'loop_escape.forbidden': ['下一步仍属同一类做法时，说「改好了」或「完成了」', '在已经试过的类别里再做一次微调'],
  'loop_escape.opt.switch': ['换成另一个做法类别', '下一步必须是你列出的替代类别之一'],
  'loop_escape.opt.narrow': ['收窄说法', '说明还没好的部分，而不是说「改好了」'],
  'loop_escape.opt.stop': ['停下来，问接下来试哪一类'],

  'gate.direction':
    'deploy-check：请先调用 deploy_check_direction（或 `deploy-check direction`）。本会话已改文件，但还没有方向审查回执。',
  'gate.loop':
    'deploy-check：请先调用 deploy_check_loop（或 `deploy-check loop`）。修改次数已达阈值，且这些修改之后没有成功的循环跳脱回执。',
  'gate.edit': (file, count, min) =>
    `deploy-check：${file} 已修改 ${count} 次（≥ ${min}）。继续改之前请调用 deploy_check_loop，并换成另一个做法类别。`,
  'gate.done':
    'deploy-check：结束前请调用 deploy_check_done（或 `deploy-check done`）。有改动就需要一份未洗测试且退出码为 0 的回执。',

  'done_evidence.premise': '没有记录一次绿的测试，也可以说做完了',
  'done_evidence.message':
    '说「做完了 / 改好了 / 测试绿了」之前，要跑配置里的测试，并留下退出码 0。不能靠洗测试冒充成功。',
  'done_evidence.forbidden': ['没有退出码 0 的记录就说「做完了 / 测试通过 / 改好了」', '把缺少测试命令当成成功'],
  'done_evidence.gap.command': '缺少测试命令（设置 done.testCommand 或传 --command）',
  'done_evidence.gap.exit': '缺少测试退出码',
  'done_evidence.gap.nonzero': (code) => `测试退出码为 ${code}（需要 0）`,
  'done_evidence.opt.rerun': ['重新跑测试后再调用 done'],
  'done_evidence.opt.narrow': ['收窄说法', '说明还没好的部分'],
  'done_evidence.opt.stop': ['停下来问'],

  'tests_untampered.premise': '靠删测试或掏空断言让套件变绿也可以',
  'tests_untampered.message':
    '未提交的 diff 像是在洗测试（删了测试，或加了 skip / assert True）。请恢复测试并改代码，或不要声称做完。',
  'tests_untampered.forbidden': ['删掉失败的测试来变绿', '用 skip / assert True / expect(true) 消音'],
  'tests_untampered.deleted': (list) => `被删的测试路径：${list}`,
  'tests_untampered.washed': (lines) => `可疑新增行：\n${lines}`,
  'tests_untampered.opt.restore': ['恢复测试'],
  'tests_untampered.opt.fix_code': ['改被测代码'],
  'tests_untampered.opt.stop': ['停下来问'],
}

const TABLES = { en, zh };

/** @returns {'en'|'zh'} */
export function resolveLang(preferred, env = process.env) {
  const pick = (v) => (v && String(v).toLowerCase().startsWith('zh') ? 'zh' : v ? 'en' : null);
  return pick(preferred) || pick(env.DEPLOY_CHECK_LANG) || (pick(env.LC_ALL || env.LC_MESSAGES || env.LANG) === 'zh' ? 'zh' : 'en');
}

export function t(lang, key, ...args) {
  const table = TABLES[lang] || en;
  const v = key in table ? table[key] : en[key];
  if (v === undefined) throw new Error(`i18n: missing key ${key}`);
  return typeof v === 'function' ? v(...args) : v;
}

/** Build card options from `<prefix>.opt.<id>` keys (falls back to shared `opt.<id>`). */
export function options(lang, prefix, ids) {
  return ids.map((id) => {
    const key = `${prefix}.opt.${id}`;
    const [label, description] = key in en ? t(lang, key) : t(lang, `opt.${id}`);
    return description ? { id, label, description } : { id, label };
  });
}

export const LANGS = Object.keys(TABLES);
export const _tables = TABLES;
