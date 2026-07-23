import type { SandpackTheme } from '@codesandbox/sandpack-react'

export const zincSandpackTheme: SandpackTheme = {
  colors: {
    surface1: '#18181b',
    surface2: '#27272a',
    surface3: '#3f3f46',
    disabled: '#52525b',
    base: '#e4e4e7',
    clickable: '#a1a1aa',
    hover: '#e4e4e7',
    accent: '#818cf8',
    error: '#f87171',
    errorSurface: '#450a0a',
    warning: '#fbbf24',
    warningSurface: '#451a03',
  },
  syntax: {
    plain: '#e4e4e7',
    comment: { color: '#71717a', fontStyle: 'italic' },
    keyword: '#818cf8',
    tag: '#818cf8',
    punctuation: '#a1a1aa',
    definition: '#a5b4fc',
    property: '#c4b5fd',
    static: '#fbbf24',
    string: '#86efac',
  },
  font: {
    body: 'ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
    size: '13px',
    lineHeight: '1.5',
  },
}
