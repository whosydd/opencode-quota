import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import {
  loadOptionalGitHubCopilotConfig,
  loadOptionalOpenCodeGoConfig,
  type PluginConfigOverrides,
} from "./config.js"
import {
  formatGitHubCopilotMessage,
  formatOpenCodeGoMessage,
  formatQuotaLoadingMessage,
  formatQuotaMessage,
} from "./format.js"
import { getGitHubCopilotQuota } from "./github-copilot.js"
import { getOpenCodeGoQuota } from "./opencode-go.js"

const COMMAND_VALUE = "model-quota.show"
const LOADING_FRAMES = ["|", "/", "-", "\\"]

let activeQuotaRequestId = 0
let stopActiveLoading: (() => void) | undefined

const tui: TuiPlugin = async (api, options) => {
  const configOverrides = options as PluginConfigOverrides | undefined

  api.command.register(() => [
    {
      title: "Show model quota",
      value: COMMAND_VALUE,
      category: "Quota",
      suggested: true,
      slash: {
        name: "model-quota",
      },
      onSelect: () => showQuotaDialog(api, configOverrides),
    },
  ])
}

async function showQuotaDialog(
  api: Parameters<TuiPlugin>[0],
  configOverrides: PluginConfigOverrides | undefined,
): Promise<void> {
  stopActiveLoading?.()

  const requestId = ++activeQuotaRequestId
  let loadingFrame = 0
  let loadingTimer: ReturnType<typeof setInterval> | undefined
  const stopLoading = () => {
    if (loadingTimer) {
      clearInterval(loadingTimer)
      loadingTimer = undefined
    }

    if (stopActiveLoading === stopLoading) {
      stopActiveLoading = undefined
    }
  }
  const closeLoadingDialog = () => {
    if (activeQuotaRequestId === requestId) {
      activeQuotaRequestId++
    }

    stopLoading()

    api.ui.dialog.clear()
  }
  const renderLoadingDialog = () => {
    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Quota",
        message: formatQuotaLoadingMessage(LOADING_FRAMES[loadingFrame]),
        onConfirm: closeLoadingDialog,
      }),
    )
  }

  stopActiveLoading = stopLoading
  renderLoadingDialog()
  loadingTimer = setInterval(() => {
    if (activeQuotaRequestId !== requestId) return

    loadingFrame = (loadingFrame + 1) % LOADING_FRAMES.length
    renderLoadingDialog()
  }, 180)

  try {
    const message = await buildQuotaMessage(configOverrides)

    if (activeQuotaRequestId !== requestId) return
    stopLoading()

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Quota",
        message,
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } catch (error) {
    if (activeQuotaRequestId !== requestId) return

    stopLoading()

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Model Quota Error",
        message: error instanceof Error ? error.message : "Failed to fetch quota.",
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } finally {
    stopLoading()
  }
}

async function buildQuotaMessage(
  configOverrides: PluginConfigOverrides | undefined,
): Promise<string> {
  const tasks: Array<Promise<string>> = []
  const errors: string[] = []

  try {
    if (loadOptionalOpenCodeGoConfig(configOverrides)) {
      tasks.push(getOpenCodeGoQuota(configOverrides).then(formatOpenCodeGoMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  try {
    if (loadOptionalGitHubCopilotConfig(configOverrides)) {
      tasks.push(getGitHubCopilotQuota(configOverrides).then(formatGitHubCopilotMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  if (tasks.length === 0) {
    if (errors.length > 0) {
      throw new Error(errors.join("\n\n"))
    }

    throw new Error(
      "No quota providers are configured. Set OpenCode Go and/or GitHub Copilot credentials in tui.json, environment variables, or opencode-model-quota.json.",
    )
  }

  const results = await Promise.allSettled(tasks)
  const messages: string[] = []
  const fetchedAt = Date.now()

  for (const result of results) {
    if (result.status === "fulfilled") {
      messages.push(result.value)
      continue
    }

    errors.push(errorMessage(result.reason))
  }

  if (messages.length === 0) {
    throw new Error(errors.join("\n\n"))
  }

  if (errors.length > 0) {
    messages.push(`Provider errors:\n- ${errors.join("\n- ")}`)
  }

  return formatQuotaMessage(messages, fetchedAt)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to fetch quota."
}

const plugin: TuiPluginModule & { id: string } = {
  id: "gy.model-status",
  tui,
}

export default plugin
