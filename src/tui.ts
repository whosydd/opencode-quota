import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { loadOptionalOpenCodeGoConfig } from "./config.js"
import {
  formatGitHubCopilotMessage,
  formatOpenAIMessage,
  formatOpenCodeGoMessage,
  formatQuotaLoadingMessage,
  formatQuotaMessage,
} from "./format.js"
import { getGitHubCopilotQuota } from "./github-copilot.js"
import { getOpenAIQuota } from "./openai.js"
import { getOpenCodeGoQuota } from "./opencode-go.js"
import { readAuthFileCached, resolveOpenAIAuth, resolveCopilotAuth } from "./opencode-auth.js"

const COMMAND_VALUE = "quota.show"
const LOADING_FRAMES = ["○", "◐", "◑", "●"]

let activeQuotaRequestId = 0
let stopActiveLoading: (() => void) | undefined

const tui: TuiPlugin = async (api) => {
  api.command.register(() => [
    {
      title: "Show quota",
      value: COMMAND_VALUE,
      category: "Quota",
      suggested: true,
      slash: {
        name: "quota",
      },
      onSelect: () => showQuotaDialog(api),
    },
  ])
}

async function showQuotaDialog(api: Parameters<TuiPlugin>[0]): Promise<void> {
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
        title: "Quota",
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
    const message = await buildQuotaMessage()

    if (activeQuotaRequestId !== requestId) return
    stopLoading()

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Quota",
        message,
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } catch (error) {
    if (activeQuotaRequestId !== requestId) return

    stopLoading()

    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "Quota Error",
        message: error instanceof Error ? error.message : "Failed to fetch quota.",
        onConfirm: () => api.ui.dialog.clear(),
      }),
    )
  } finally {
    stopLoading()
  }
}

async function buildQuotaMessage(): Promise<string> {
  const tasks: Array<Promise<string>> = []
  const errors: string[] = []

  try {
    if (loadOptionalOpenCodeGoConfig()) {
      tasks.push(getOpenCodeGoQuota().then(formatOpenCodeGoMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  try {
    const auth = await readAuthFileCached()
    const hasOAuthCopilot = resolveCopilotAuth(auth) !== null

    if (hasOAuthCopilot) {
      tasks.push(getGitHubCopilotQuota().then(formatGitHubCopilotMessage))
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  try {
    const auth = await readAuthFileCached()
    const hasOpenAI = resolveOpenAIAuth(auth) !== null

    if (hasOpenAI) {
      tasks.push(
        getOpenAIQuota().then((snapshot) => {
          if (!snapshot) throw new Error("OpenAI quota data not available.")
          return formatOpenAIMessage(snapshot)
        }),
      )
    }
  } catch (error) {
    errors.push(errorMessage(error))
  }

  if (tasks.length === 0) {
    if (errors.length > 0) {
      throw new Error(errors.join("\n\n"))
    }

    throw new Error(
      "No quota providers are configured. Set OpenCode Go credentials in environment variables, and log in to GitHub Copilot and/or OpenAI through OpenCode.",
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
  id: "whosydd.opencode-quota",
  tui,
}

export default plugin
