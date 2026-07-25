import { createTheme } from '@uiw/codemirror-themes'
import { tags as t } from '@lezer/highlight'

// Mirrors the same zinc/indigo palette as sandpackTheme.ts, so Python and
// JS/React demos look like one system rather than two different editors.
export const zincCodeMirrorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#09090b',
    foreground: '#e4e4e7',
    caret: '#818cf8',
    selection: '#3730a340',
    selectionMatch: '#3730a340',
    lineHighlight: '#27272a60',
    gutterBackground: '#09090b',
    gutterForeground: '#52525b',
    gutterBorder: 'transparent',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  },
  styles: [
    { tag: t.comment, color: '#71717a', fontStyle: 'italic' },
    { tag: t.string, color: '#86efac' },
    { tag: [t.number, t.bool, t.null], color: '#fbbf24' },
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: '#818cf8' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#a5b4fc' },
    { tag: t.definition(t.variableName), color: '#e4e4e7' },
    { tag: t.className, color: '#c4b5fd' },
    { tag: t.operator, color: '#a1a1aa' },
    { tag: t.punctuation, color: '#a1a1aa' },
    { tag: t.propertyName, color: '#c4b5fd' },
    { tag: t.self, color: '#fbbf24', fontStyle: 'italic' },
  ],
})
