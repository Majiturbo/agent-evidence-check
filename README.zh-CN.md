# deploy-check

[English](./README.md)

**在 Agent 把判断说成定论之前，先要收据** —— 方向、「改好了」、「测试绿了」、或「已经上线」。不是每条消息都跑的语义前提中间件。

如果你在用编码 Agent，却总听到言之凿凿、记录里却没有证据，这个库就是为你写的。

| 判断 | 失败模式 | 要什么证据 | 怎么跑 |
|---|---|---|---|
| 方向 | 顺从指令；不问伪需求、替代方案、更近的路 | 目标、当前路径、一条**不同的**更近路径、为何不走、一条事实 | CLI / MCP `direction`；可选 Stop 闸 |
| 循环 | 同一类修法，仍说「改好了」 | 修改 / 否定次数；下一步必须离开该类 | CLI / MCP `loop`；可选 Stop / 编辑闸 |
| 完成 | 改完就说做完 / 测试绿 | `testCommand` 退出码 0；未提交测试 diff 未洗 | CLI / MCP `done`；可选 `doneGate` |
| 部署 | stash / 只发一半 / 热修后说「上线了」 | 干净工作区、明确 SHA、已推送、单元与 observe 一致 | shell 钩子 + CLI / MCP `pre` / `verify` |

包名是历史遗留（先做了部署钩子）。产品是上面四张判断。方向、循环、完成**不读对话** —— 由调用方（或 Agent 经 MCP）提交记录。

## 先试 90 秒

在本仓库检出目录下（Node ≥ 22）：

```bash
npm test
node bin/check-deploy.mjs init --cwd /tmp/sample-app --lang zh

# 更近路径与当前路径相同 → 拦住
node bin/check-deploy.mjs direction --cwd /tmp/sample-app \
  --moment start --goal '把慢页面变快' \
  --path '重写渲染层' \
  --nearer '重写渲染层' \
  --why '继续做' --evidence '用户说页面慢'

# 同一做法类 + 声称已修好 → 拦住
node bin/check-deploy.mjs loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried '微调样式' --next '微调样式'

# 没有绿测试记录 → 拦住
node bin/check-deploy.mjs done --cwd /tmp/sample-app --no-run --exit-code 1
```

精简后的 `direction` 发现（advisory 下仍 `allow: true`；要硬拦请开闸）：

```json
{
  "ok": false,
  "findings": [{
    "checkId": "direction_review",
    "severity": "block",
    "premise": "不写下另一条路，也可以继续走当前这条",
    "evidence": "更近的路径和当前路径相同"
  }]
}
```

要过关：写出**不同的**更近路径 / 下一步类别，或退出码 0。约定：[`docs/judgments.md`](docs/judgments.md)。

## 接到应用仓库

```bash
node bin/check-deploy.mjs init --cwd /path/to/your-app --lang zh
node bin/check-deploy.mjs doctor --cwd /path/to/your-app
npm run install-hooks    # 可选；用户级安装，无 deploy-units.json 时不生效
```

登记后开硬闸（Stop / 编辑 / 完成）：

```json
"judgments": { "stopGate": true, "editGate": true, "doneGate": true }
```

消费方规则：[`docs/rules/deploy-check.zh-CN.md`](docs/rules/deploy-check.zh-CN.md)。卸载钩子：`node scripts/install-hooks.mjs --uninstall`。

**MCP：** `node bin/deploy-check-mcp.mjs`，工具为 `deploy_check_direction` / `_loop` / `_done` / `_pre` / `_verify`，传 `{ "cwd": "/path/to/your-app" }`。见 [`docs/mcp.md`](docs/mcp.md)。

**发布到 npm 之后：** `npx deploy-check …`、`npx deploy-check-install-hooks`、`npx deploy-check-mcp`。

状态：**v0.1，实验版。** macOS / Linux / Windows（`node` 在 `PATH`）。默认英文提示；`"lang": "zh"` 或 `DEPLOY_CHECK_LANG=zh`。可先 `DEPLOY_CHECK_MODE=shadow`。各宿主界面可能还需开一次钩子 — [`docs/hook-setup.md`](docs/hook-setup.md)。

## 包含什么

| 组件 | 作用 |
|---|---|
| 应用仓库里的 `deploy-units.json` | 自愿登记；单元、`done` / `loop` / `judgments` |
| CLI `deploy-check` | `direction`、`loop`、`done`、`pre-deploy`、`verify`、`init`、`doctor` |
| `deploy-check-mcp` | 同上五个判断工具（stdio MCP） |
| `hooks/bridge.mjs` + `hooks/run.sh` | 部署 shell 桥；可选 Stop / 编辑闸 |
| [`docs/adapters.md`](docs/adapters.md) | 钩子矩阵（Cursor、Claude Code、Codex、Trae、Copilot、Qoder、DSH） |

默认 **advisory**。不替代 CI、GitOps 或厂商沙箱。正规发布仍应用 worktree + 推送 + 流水线；这个库是 Agent 仍无收据就下结论时的兜底。

## 检查项（封闭注册表）

只能选这些 id，不能自造名字。

**方向 / 循环 / 完成**（仅 CLI 或 MCP）

- `direction_review` — 开干前：强制写出更近 / 可替代路径  
- `loop_escape` — 触发阈值后，下一步必须离开已失败的做法类  
- `done_evidence` — 说做完前必须有退出码 0 的测试记录  
- `tests_untampered` — 未提交的测试 diff 不能删测试或加 skip / assert True  

**部署**（shell 钩子 + `pre` / `verify`）

- `dirty_tree` — 脏工作区；**禁止用 stash / checkout 清场**  
- `deploy_from_commit` / `unpushed` — 明确 SHA，且已在远程跟踪分支  
- `units_declared` / `units_match` — 已声明单元；部署后 observe 对得上  
- `hotpatch_drift` — 线上热修必须回到 git  

`verify` / observe：[`docs/verify.md`](docs/verify.md)。自定义检查只能用 `custom:` 前缀。

## 非目标

- 每条消息的语义前提拦截  
- 替代厂商 shell 沙箱 / Auto-review  
- 编造省 token、抗循环之类营销数字  
- 未读公开钩子文档、未跑烟雾就宣称支持某宿主  

## 证据与贡献

普适模式案例（无私人主机）：[`docs/cases/`](docs/cases/) — 方向、修补循环、无测试收据的完成、跨工具 stash、部分上线。决策记录：[`docs/decisions/`](docs/decisions/)。人工贡献：[`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 许可证

MIT
