# deploy-check

[English](./README.md)

[![npm](https://img.shields.io/npm/v/@majiturbo/deploy-check.svg)](https://www.npmjs.com/package/@majiturbo/deploy-check)
[![CI](https://github.com/Majiturbo/deploy-check/actions/workflows/ci.yml/badge.svg)](https://github.com/Majiturbo/deploy-check/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/@majiturbo/deploy-check.svg)](https://www.npmjs.com/package/@majiturbo/deploy-check)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> 在编码 Agent 把判断说成定论之前，先要收据。

Agent 听起来很有把握。它们说「按指令做」「改好了」「测试绿了」「已经上线」——记录里却常常什么都没有。厂商已经管了很多危险 shell。**deploy-check** 管它们不管的那截：封闭的检查注册表、统一的澄清卡片（CLI / MCP）、可选的薄钩子。

它**不读对话**。也**不是**每条消息的前提中间件。

| 它说 | 缺的是 |
|---|---|
| 「按你的指令做就行。」 | 写下一条更近 / 更便宜的路 |
| 「改好了。」 | 离开已经失败的那类做法 |
| 「测试绿了 / 做完了。」 | 一次退出码 `0` 的记录（测试没被洗） |
| 「已经上线。」 | 干净工作区、已推送的 SHA、每个单元与 observe 一致 |

## 特性

- **四种判断** — `direction`、`loop`、`done`，以及部署（`pre` / `verify`）
- **封闭检查注册表** — 只能选已有 id，不能自造名字（扩展只用 `custom:`）
- **CLI + MCP** — 同一套 API；工具 `deploy_check_direction` / `_loop` / `_done` / `_pre` / `_verify`
- **按仓库自愿启用** — 钩子可装在用户级，但**没有** `deploy-units.json` 时一律放行
- **可选硬闸** — 配置后 Stop / 编辑 / 完成会逼着调对应命令
- **部署后 observe** — `http_json`、`http_text`、`file_sha256`、`command`、`literal`
- **钩子出错 fail open** — 缺 Node / 坏 JSON / 未知载荷 → 放行并写明原因
- **默认英文 UX** — 中文用 `"lang": "zh"` 或 `DEPLOY_CHECK_LANG=zh`
- **宿主矩阵** — Cursor、Claude Code、Codex、Trae、Copilot、Qoder、DSH（[诚实矩阵](docs/adapters.md)）

## 安装

```bash
npm i -g @majiturbo/deploy-check
# 或一次性：
npx @majiturbo/deploy-check --help
```

> **注意：** 请在*本仓库检出目录之外*跑 `npx`。在仓库里面，`npx` 会解析到本地包且没有 `.bin` 链接 — 请改用 `node bin/check-deploy.mjs …`。

要求：**Node ≥ 22**，`git` 在 `PATH`。macOS / Linux / Windows。

## 快速开始

```bash
cd /tmp
npx @majiturbo/deploy-check init --cwd /tmp/sample-app --lang zh

# 更近路径与当前路径相同 → 拦住
npx @majiturbo/deploy-check direction --cwd /tmp/sample-app \
  --moment start \
  --goal '把慢页面变快' \
  --path '重写渲染层' \
  --nearer '重写渲染层' \
  --why '继续做' \
  --evidence '用户说页面慢'
```

精简结果（advisory 下仍 `allow: true`；要硬拦请开闸）：

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

要过关：写出**不同的**更近路径：

```bash
npx @majiturbo/deploy-check direction --cwd /tmp/sample-app \
  --moment start \
  --goal '把慢页面变快' \
  --path '重写渲染层' \
  --nearer '先 profiling，再改热点' \
  --why '还没有性能数据' \
  --evidence '用户说页面慢'
```

### 循环与完成

```bash
# 同一做法类 + 声称已修好 → 拦住
npx @majiturbo/deploy-check loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried '微调样式' --next '微调样式'

# 离开该类 → 通过
npx @majiturbo/deploy-check loop --cwd /tmp/sample-app \
  --target src/page.tsx --edits 8 --rejections 3 --claims-fixed \
  --tried '微调样式' --next '去掉特效' --alternative '去掉特效'

# 没有绿测试记录 → 拦住
npx @majiturbo/deploy-check done --cwd /tmp/sample-app --no-run --exit-code 1

# 退出码 0 → 通过（同时扫描未提交测试 diff 是否被洗）
npx @majiturbo/deploy-check done --cwd /tmp/sample-app --no-run --exit-code 0
```

完整约定：[`docs/judgments.md`](docs/judgments.md)。

## 接到应用仓库

```bash
npx @majiturbo/deploy-check init --cwd /path/to/your-app --lang zh
npx @majiturbo/deploy-check doctor --cwd /path/to/your-app

# 可选：用户级钩子（Cursor、Claude Code、Codex …）
npx -p @majiturbo/deploy-check deploy-check-install-hooks
```

`init` 会写入 `deploy-units.json` 和一段 `AGENTS.md`。编辑单元与 observe — 见 [`docs/verify.md`](docs/verify.md)、[`examples/deploy-units.example.json`](examples/deploy-units.example.json)。

### 硬闸

```json
"judgments": { "stopGate": true, "editGate": true, "doneGate": true }
```

然后重新跑 install-hooks。Stop / 编辑需要 `.deploy-check/` 里近期通过的 `direction` / `loop` / `done` 收据。消费方规则：[`docs/rules/deploy-check.zh-CN.md`](docs/rules/deploy-check.zh-CN.md)。

卸载：`npx -p @majiturbo/deploy-check deploy-check-install-hooks --uninstall`（或在 clone 里 `node scripts/install-hooks.mjs --uninstall`）。

### MCP

```bash
npx -p @majiturbo/deploy-check deploy-check-mcp
```

在宿主里配 stdio MCP；每次调用传 `{ "cwd": "/path/to/your-app" }`。片段：[`examples/mcp.cursor.fragment.json`](examples/mcp.cursor.fragment.json)、[`examples/mcp.claude-desktop.fragment.json`](examples/mcp.claude-desktop.fragment.json)。详见 [`docs/mcp.md`](docs/mcp.md)。

### 部署路径

```bash
npx @majiturbo/deploy-check --cwd /path/to/your-app --shadow
npx @majiturbo/deploy-check verify --cwd /path/to/your-app
```

默认 **advisory**。正规发布仍优先 worktree + 推送 + CI/GitOps；这个库兜住 Agent 仍无收据就说「上线」的情况。

## 检查项（封闭注册表）

只能选这些 id。

**方向 / 循环 / 完成**（CLI 或 MCP）

| Id | 作用 |
|---|---|
| `direction_review` | 开干前：强制写出更近 / 可替代路径 |
| `loop_escape` | 触发阈值后，下一步必须离开已失败的做法类 |
| `done_evidence` | 说做完前必须有退出码 `0` 的测试记录 |
| `tests_untampered` | 未提交测试 diff 不能删测试或加 skip / assert True |

**部署**（shell 钩子 + `pre` / `verify`）

| Id | 作用 |
|---|---|
| `dirty_tree` | 脏工作区；**禁止用 stash / checkout 清场** |
| `deploy_from_commit` | 必须有明确 git SHA |
| `unpushed` | SHA 必须在远程跟踪分支上 |
| `units_declared` / `units_match` | 已声明单元；部署后 observe 对得上 |
| `hotpatch_drift` | 线上热修必须回到 git |

自定义检查只能用 `custom:` 前缀。

## 包含什么

| 组件 | 作用 |
|---|---|
| `deploy-units.json` | 自愿登记；单元、`done` / `loop` / `judgments` |
| CLI `deploy-check` | `direction`、`loop`、`done`、`pre-deploy`、`verify`、`init`、`doctor` |
| `deploy-check-mcp` | 同上五个判断工具（stdio MCP） |
| `hooks/bridge.mjs` + `hooks/run.sh` | 部署 shell 桥；可选 Stop / 编辑闸 |
| [`docs/adapters.md`](docs/adapters.md) | 各宿主钩子矩阵 |

## 非目标

- 每条消息的语义前提拦截  
- 替代厂商 shell 沙箱 / Auto-review  
- 编造省 token、抗循环之类营销数字  
- 未读公开钩子文档、未跑烟雾就宣称支持某宿主  

## 文档

| 文档 | 内容 |
|---|---|
| [`docs/judgments.md`](docs/judgments.md) | 何时调 direction / loop / done；证据字段 |
| [`docs/rules/deploy-check.zh-CN.md`](docs/rules/deploy-check.zh-CN.md) | 消费方 `AGENTS.md` 约定 |
| [`docs/verify.md`](docs/verify.md) | observe 类型与 `verify` |
| [`docs/mcp.md`](docs/mcp.md) | MCP 接入 |
| [`docs/hook-setup.md`](docs/hook-setup.md) | 安装 / 卸载钩子 |
| [`docs/adapters.md`](docs/adapters.md) | 宿主支持矩阵 |
| [`docs/cases/`](docs/cases/) | 每条检查背后的模式案例 |
| [`examples/`](examples/) | 配置片段（钩子、MCP、单元） |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 开发命令与发布清单 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本说明 |
| [`SECURITY.md`](SECURITY.md) | 安全反馈 |

## 状态

**v0.1，实验版。** 默认英文提示；`"lang": "zh"` 或 `DEPLOY_CHECK_LANG=zh`。可先 `DEPLOY_CHECK_MODE=shadow`。部分宿主界面需要开一次开关 — 见 [`docs/hook-setup.md`](docs/hook-setup.md)。

包：[`@majiturbo/deploy-check`](https://www.npmjs.com/package/@majiturbo/deploy-check)  
源码：[`Majiturbo/deploy-check`](https://github.com/Majiturbo/deploy-check)

## 许可证

MIT
