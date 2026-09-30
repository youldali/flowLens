// @vitest-environment jsdom

import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { openCliSource } from './openCliSource'

afterEach(() => vi.restoreAllMocks())

describe('openCliSource', () => {
  it('opens the selected file and offset in the local source viewer', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    openCliSource('/project/src/runner.ts', 174)

    assert.equal(open.mock.calls.length, 1)
    const [href, target, features] = open.mock.calls[0]!
    const url = new URL(href!)
    assert.equal(url.pathname, '/source')
    assert.equal(url.searchParams.get('filePath'), '/project/src/runner.ts')
    assert.equal(url.searchParams.get('offset'), '174')
    assert.equal(url.hash, '#selected')
    assert.equal(target, '_blank')
    assert.equal(features, 'noopener')
  })
})
