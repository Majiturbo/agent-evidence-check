# 0003 开源形态：仓库契约为真源，工具只做薄转接

- 状态：已接受
- 日期：2026-11-11
- 关联：`docs/adapters.md`、`docs/rules/deploy-check.md`、`0002-product-redeploy.md`

## 决定

不做「每个 IDE 一个产品」。开源适配面用三层：

1. **契约**（所有工具必做）：`deploy-units.json` + `docs/rules/deploy-check.md` + `bin/check-deploy.mjs`
2. **硬钩子**（有公开 before-shell / PreToolUse 的工具）：统一走 `hooks/bridge.mjs`
3. **软约束**（暂无钩子或未核实）：只靠 `AGENTS.md` 引用规则文件

当前硬钩子已接：Cursor、Claude Code、Codex。  
规则层覆盖：VS Code Copilot、DSH、Trae、Qoder（及任何读 `AGENTS.md` 的工具）。

## 理由

- Trae ↔ Cursor 冲突发生在 **git 工作区**，不在某一 IDE 进程内；仓库级契约才是跨工具的交点。
- 各厂商钩子 JSON 形状不同，但输入都能归一成 `command + cwd`；检查逻辑只维护一份。
- 对未公开钩子的工具，写「已适配」会变成虚假宣传；矩阵里标「规则层 / 未核实」并欢迎 PR。

## 后果

- README 与 `docs/adapters.md` 必须带诚实矩阵，不写未联调的「支持」。
- 新增工具适配 = 增加一种 stdin 方言或一份规则引用，禁止复制六套 dirty_tree。

## 修订（2026-11-11 晚）

原先标为「规则层 / 未核实」的四家已对照公开文档核实，**均有硬钩子**：

- VS Code Copilot：`preToolUse`（Preview）
- Trae：`PreToolUse` + matcher **`RunCommand`**
- Qoder：`PreToolUse` + `Bash`
- DSH：`tools/pre-execute` 与/或 Claude-Code hooks 桥

`hooks/bridge.mjs` 已增加 Copilot camelCase 与 Trae `RunCommand` 方言。DSH 若未装 hooks 桥插件，应开启「导入 Claude Code hooks」或安装官方/社区桥；仅写入 `~/.dsh/hooks.json` 不一定生效（见 `docs/adapters.md`）。
