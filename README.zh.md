# opencode-model-quota

<!-- README-I18N:START -->

[English](./README.md) | **中文**

<!-- README-I18N:END -->

OpenCode TUI 插件，用于查看模型或订阅配额。

## 支持的提供商

> **当前仅支持 OpenCode Go 和 GitHub Copilot。** 未来可能会添加更多提供商。

- **OpenCode Go** — 滚动、周度和月度订阅配额（通过 HTML 解析）
- **GitHub Copilot** — 月度高级请求配额、额度和超额用量

仅当凭据已配置时，对应提供商才会运行。未配置的提供商会自动跳过。

## 命令

| 命令 | 说明 |
|---------|------|
| `/model-quota` | 获取并显示所有已配置提供商的当前配额 |

该命令始终获取最新数据。加载动画会在各提供商并行查询期间显示。

## 输出示例

配额以卡片式对话框展示，包含进度条、百分比和重置计时：

```
+--------------------------------------------+
| [OpenCode Go] [subscription]               |
|                                            |
| Rolling: [########------------]  33% 5m    |
| Weekly:  [############--------]  50% 3d 2h |
| Monthly: [####################]  83% 12d   |
+--------------------------------------------+

                Updated: Apr 27, 2:30 PM
```

## 安装

### 1. 通过 npm 安装（推荐）

```bash
npm install opencode-model-quota
```

### 2. 注册到 OpenCode

在 `tui.json` 中添加插件：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "opencode-model-quota",
      {
        "opencodeGo": {
          "workspaceId": "wrk_your_workspace_id",
          "authCookie": "{env:OPENCODE_GO_AUTH_COOKIE}"
        },
        "githubCopilot": {
          "username": "your-github-login",
          "token": "{env:GITHUB_COPILOT_TOKEN}",
          "plan": "pro"
        }
      }
    ]
  ]
}
```

仅配置你需要的提供商。省略 `opencodeGo` 或 `githubCopilot` 即可跳过该提供商。

### 3. 验证

重启 OpenCode，在 TUI 中运行 `/model-quota`。

<details>
<summary>手动构建（开发人员）</summary>

```bash
git clone https://github.com/whosydd/opencode-model-usage.git
cd opencode-model-usage
npm install
npm run build
```

然后使用 `dist/tui.js` 的绝对路径进行注册。
</details>

## 配置

优先级：`tui.json` 插件选项 → 环境变量。

### 环境变量

```bash
export OPENCODE_GO_WORKSPACE_ID="wrk_your_workspace_id"
export OPENCODE_GO_AUTH_COOKIE="Fe26.2**your_auth_cookie"

export GITHUB_COPILOT_USERNAME="your-github-login"
export GITHUB_COPILOT_TOKEN="github_pat_your_token"
export GITHUB_COPILOT_PLAN="pro"  # "pro" 或 "pro+"
```

### 获取 OpenCode Go 凭据

**Workspace ID：**

1. 登录 [opencode.ai](https://opencode.ai) 并打开 Go 页面。
2. URL 格式为 `https://opencode.ai/workspace/wrk_xxxxxxxx/go`。
3. 其中 `wrk_xxxxxxxx` 即为你的 workspace ID。

**Auth Cookie：**

1. 在浏览器中登录 [opencode.ai](https://opencode.ai)。
2. 打开开发者工具（F12 或 Ctrl+Shift+I / Cmd+Option+I）。
3. 进入 **Application** → **Cookies** → `https://opencode.ai`。
4. 找到名为 `auth` 的 Cookie 并复制其值。
5. 该值以 `Fe26.2**` 开头，是一段很长的字符串。

> Cookie 会定期过期。如果配额获取出现身份验证错误，请重新执行以上步骤获取新的 Cookie。

### 配置模型详情

`tui.json` 或环境变量中的字符串值支持 `{env:VARIABLE_NAME}` 占位符。不支持 Shell 命令占位符（如 `{env:$(gh auth token)}`）。

`githubCopilot.plan` 仅支持 `"pro"`（300 请求/月）和 `"pro+"`（1500 请求/月），省略时默认为 `"pro"`。

## GitHub Copilot 数据来源

插件按顺序尝试两个 GitHub API 端点：

1. **配额快照**（`/copilot_internal/user`）— 与 VS Code 中显示的用量一致。当令牌有权访问 Copilot 内部 API 时返回。
2. **账单用量**（`/users/{username}/settings/billing/premium_request/usage`）— 仅限个人账单。当快照端点返回 404 时回退使用。不包含组织管理的许可证。

配额快照的身份验证、权限和频率限制错误会直接展示，不会被账单回退掩盖。
