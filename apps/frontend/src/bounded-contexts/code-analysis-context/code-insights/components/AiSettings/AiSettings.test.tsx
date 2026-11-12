// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import translations from '../../../../../../public/locales/en/code-analysis-context.json'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { createVsCodeEvent, isAiSettingsSaveEvent, type VsCodeEventRegistry } from '@flowlens/registries/vscode-events'
import { AppShell } from '#common/test-utils/appShell.tsx'
import type { AiConfiguration } from '@flowlens/registries/vscode-events'
import { AiSettings } from './AiSettings'

const i18n = createInstance()

beforeEach(async () => {
  await i18n.init({ lng: 'en', resources: { en: { 'code-analysis-context': translations } }, interpolation: { escapeValue: false } })
  // jsdom has no top layer; real-browser checks cover native modal behavior.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.open = true
    this.querySelector<HTMLButtonElement>('button')?.focus()
  } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup(initial?: AiConfiguration) {
  let configuration: AiConfiguration = initial ?? { backend: 'openai-api', credentialPresence: { openai: true, anthropic: false } }
  const saves: VsCodeEventRegistry['ai.settings.save'][] = []
  let loadError = false
  const postMessage = vi.fn((message: unknown) => {
    const request = message as VsCodeEventRegistry['ai.settings.get' | 'ai.settings.save']
    if (isAiSettingsSaveEvent(request)) saves.push(request)
    else if (request.type === 'ai.settings.get') {
      reply(loadError
        ? createVsCodeEvent('ai.settings.error', { requestId: request.payload.requestId, reason: 'unsupported' })
        : createVsCodeEvent('ai.settings.result', { requestId: request.payload.requestId, configuration }))
    }
  })
  const rendered = render(<I18nextProvider i18n={i18n}><AppShell config={{ runtimeHost: 'vscode', vscodeApi: { postMessage } }}><AiSettings /></AppShell></I18nextProvider>)

  return {
    ...rendered, saves, postMessage,
    setLoadError: () => { loadError = true },
    confirm: async (saved: AiConfiguration) => {
      configuration = saved
      await act(async () => reply(createVsCodeEvent('ai.settings.result', { requestId: saves.at(-1)!.payload.requestId, configuration })))
    },
    fail: async () => {
      await act(async () => reply(createVsCodeEvent('ai.settings.error', { requestId: saves.at(-1)!.payload.requestId, reason: 'save-failed' })))
    },
  }
}

function reply(message: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data: message }))
}

async function open() {
  const trigger = screen.getByRole('button', { name: 'Open AI settings' })
  trigger.focus()
  fireEvent.click(trigger)
  await screen.findByRole('combobox', { name: 'Backend' })
  return trigger
}

function selectBackend(backend: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Backend' }), { target: { value: backend } })
}

describe('AiSettings', () => {
  it('wraps keyboard focus at both ends of the dialog', async () => {
    setup()
    await open()
    const first = screen.getByRole('button', { name: 'Close AI settings' })
    const last = screen.getByRole('button', { name: 'Save' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    assert.equal(document.activeElement, last)
    fireEvent.keyDown(last, { key: 'Tab' })
    assert.equal(document.activeElement, first)
  })

  it('loads the host backend and shows provider-specific masked fields, status and CLI guidance', async () => {
    setup({ backend: 'claude-api', credentialPresence: { openai: true, anthropic: false } })
    await waitFor(() => assert.match(screen.getByRole('button', { name: 'Open AI settings' }).textContent!, /Claude API/))
    await open()
    assert.ok(screen.getByRole('dialog', { name: 'AI settings' }))
    assert.ok(screen.getByText('Used by all AI actions in FlowLens'))
    const select = screen.getByRole('combobox', { name: 'Backend' }) as HTMLSelectElement
    assert.deepEqual(Array.from(select.options, option => [option.text, option.value]), [
      ['OpenAI API', 'openai-api'], ['Claude API', 'claude-api'], ['Codex CLI', 'codex-cli'],
    ])
    assert.ok(screen.getByText('No key configured'))
    assert.equal((screen.getByLabelText('Claude API key') as HTMLInputElement).type, 'password')
    selectBackend('openai-api')
    const input = screen.getByLabelText('OpenAI API key') as HTMLInputElement
    assert.equal(input.value, '')
    assert.ok(screen.getByText('Key configured'))
    assert.ok(screen.getByText('Leave blank to keep your existing key.'))
    fireEvent.change(input, { target: { value: 'draft-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }))
    assert.equal(input.type, 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide API key' }))
    assert.equal(input.type, 'password')
    selectBackend('codex-cli')
    assert.equal(screen.queryByLabelText('OpenAI API key'), null)
    assert.ok(screen.getByText('Uses your Codex CLI authentication'))
    assert.ok(screen.getByText('Sign in through Codex CLI to use this backend.'))
  })

  for (const dismissal of ['Cancel', 'Close AI settings', 'Escape']) {
    it(`discards drafts, clears keys and restores focus on ${dismissal}`, async () => {
      const { saves } = setup()
      const trigger = await open()
      fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: 'discard-me' } })
      selectBackend('claude-api')
      fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'discard-me-too' } })
      if (dismissal === 'Escape') fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
      else fireEvent.click(screen.getByRole('button', { name: dismissal }))
      assert.equal(screen.queryByRole('dialog'), null)
      assert.equal(document.activeElement, trigger)
      assert.match(trigger.textContent!, /OpenAI API/)
      assert.equal(saves.length, 0)
      await open()
      assert.equal((screen.getByRole('combobox') as HTMLSelectElement).value, 'openai-api')
      assert.equal((screen.getByLabelText('OpenAI API key') as HTMLInputElement).value, '')
      selectBackend('claude-api')
      assert.equal((screen.getByLabelText('Claude API key') as HTMLInputElement).value, '')
    })
  }

  it('submits only the selected provider’s key and changes shared state only after confirmation', async () => {
    const { saves, confirm } = setup()
    const trigger = await open()
    fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: 'openai-draft' } })
    selectBackend('claude-api')
    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'claude-draft' } })
    selectBackend('openai-api')
    assert.equal((screen.getByLabelText('OpenAI API key') as HTMLInputElement).value, 'openai-draft')
    selectBackend('claude-api')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const form = screen.getByRole('combobox').closest('form')!
    fireEvent.submit(form)
    await waitFor(() => assert.equal(saves.length, 1))
    assert.deepEqual(saves[0]!.payload.configuration, { backend: 'claude-api', credential: { provider: 'anthropic', apiKey: 'claude-draft' } })
    assert.ok(screen.getByRole('status'))
    assert.equal((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled, true)
    assert.match(trigger.textContent!, /OpenAI API/)
    assert.ok(screen.getByText('No key configured'))
    await confirm({ backend: 'claude-api', credentialPresence: { openai: true, anthropic: true } })
    assert.equal(screen.queryByRole('dialog'), null)
    assert.equal(document.activeElement, trigger)
    assert.match(trigger.textContent!, /Claude API/)
    await open()
    assert.equal((screen.getByLabelText('Claude API key') as HTMLInputElement).value, '')
    assert.ok(screen.getByText('Key configured'))
  })

  it('omits blank keys and keys entered for another provider, including when saving CLI', async () => {
    const { saves, confirm } = setup()
    await open()
    fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: 'openai-only' } })
    selectBackend('claude-api')
    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => assert.equal(saves.length, 1))
    assert.deepEqual(saves[0]!.payload.configuration, { backend: 'claude-api' })
    await confirm({ backend: 'claude-api', credentialPresence: { openai: true, anthropic: false } })
    await open()
    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'claude-only' } })
    selectBackend('openai-api')
    fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: 'openai-api-only' } })
    selectBackend('codex-cli')
    assert.equal(screen.queryByLabelText('OpenAI API key'), null)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => assert.equal(saves.length, 2))
    assert.deepEqual(saves[1]!.payload.configuration, { backend: 'codex-cli' })
    await confirm({ backend: 'codex-cli', credentialPresence: { openai: true, anthropic: false } })
    await open()
    assert.equal((screen.getByRole('combobox') as HTMLSelectElement).value, 'codex-cli')
  })

  it('keeps failed drafts open and supports retry without claiming a key is configured', async () => {
    const { saves, fail, confirm } = setup()
    await open()
    selectBackend('claude-api')
    fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'retry-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => assert.equal(saves.length, 1))
    await fail()
    assert.match(screen.getByRole('alert').textContent!, /try Save again/)
    assert.ok(screen.getByText('No key configured'))
    assert.equal((screen.getByLabelText('Claude API key') as HTMLInputElement).value, 'retry-secret')
    assert.match(screen.getByRole('button', { name: 'Open AI settings' }).textContent!, /OpenAI API/)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => assert.equal(saves.length, 2))
    await confirm({ backend: 'claude-api', credentialPresence: { openai: true, anthropic: true } })
    assert.equal(screen.queryByRole('dialog'), null)
  })

  it('explicitly reports unsupported hosts and disables Save without credential claims', async () => {
    const { setLoadError, saves } = setup()
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    setLoadError()
    fireEvent.click(screen.getByRole('button', { name: 'Open AI settings' }))
    assert.match((await screen.findByRole('alert')).textContent!, /does not support AI settings yet/)
    assert.equal((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled, true)
    assert.equal(screen.queryByText('Key configured'), null)
    assert.ok(screen.getByRole('button', { name: 'Retry' }))
    assert.equal(saves.length, 0)
  })
})
