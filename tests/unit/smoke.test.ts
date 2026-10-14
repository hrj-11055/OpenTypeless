import { describe, it, expect } from 'vitest'
import pkg from '../../package.json'

describe('smoke', () => {
  it('package identity is pinned', () => {
    expect(pkg.name).toBe('opentypeless')
    expect(pkg.license).toBe('MIT')
    // native-ABI-sensitive deps must be pinned exactly
    expect((pkg.devDependencies as Record<string, string>).electron).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
