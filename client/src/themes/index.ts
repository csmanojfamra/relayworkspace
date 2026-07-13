export type ThemeId = 'apple-notes' | 'apple-notes-dark';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  vars: Record<string, string>;
}

/** Apple Notes–inspired palettes. Yellow accent, paper surfaces, quiet chrome. */
export const themes: ThemeDefinition[] = [
  {
    id: 'apple-notes',
    label: 'Notes Light',
    vars: {
      '--bg': '#f5f5f7',
      '--bg-elevated': '#ffffff',
      '--bg-soft': '#ebebef',
      '--panel': 'rgba(255, 255, 255, 0.92)',
      '--border': 'rgba(60, 60, 67, 0.12)',
      '--border-strong': 'rgba(60, 60, 67, 0.22)',
      '--text': '#1c1c1e',
      '--text-muted': '#6c6c70',
      '--text-faint': '#8e8e93',
      '--accent': '#f5c518',
      '--accent-soft': 'rgba(245, 197, 24, 0.18)',
      '--accent-ink': '#1c1c1e',
      '--danger': '#ff3b30',
      '--warning': '#ff9f0a',
      '--me': '#007aff',
      '--peer': '#34c759',
      '--cursor': '#1c1c1e',
      '--glow': 'rgba(245, 197, 24, 0.22)',
      '--shadow': '0 8px 28px rgba(0, 0, 0, 0.06)',
      '--scrollbar': 'rgba(60, 60, 67, 0.22)',
      '--note': '#fffdf6',
      '--note-local': '#fffdf6',
      '--note-remote': '#f7fbf8',
      '--note-border': 'rgba(60, 60, 67, 0.08)',
      '--note-shadow': '0 1px 2px rgba(0, 0, 0, 0.04)',
      '--sidebar': '#f2f2f7',
      '--paper-line': 'rgba(245, 197, 24, 0.28)',
    },
  },
  {
    id: 'apple-notes-dark',
    label: 'Notes Dark',
    vars: {
      '--bg': '#1c1c1e',
      '--bg-elevated': '#2c2c2e',
      '--bg-soft': '#3a3a3c',
      '--panel': 'rgba(44, 44, 46, 0.94)',
      '--border': 'rgba(255, 255, 255, 0.1)',
      '--border-strong': 'rgba(255, 255, 255, 0.18)',
      '--text': '#f5f5f7',
      '--text-muted': '#aeaeb2',
      '--text-faint': '#8e8e93',
      '--accent': '#ffd60a',
      '--accent-soft': 'rgba(255, 214, 10, 0.16)',
      '--accent-ink': '#1c1c1e',
      '--danger': '#ff453a',
      '--warning': '#ff9f0a',
      '--me': '#0a84ff',
      '--peer': '#30d158',
      '--cursor': '#f5f5f7',
      '--glow': 'rgba(255, 214, 10, 0.14)',
      '--shadow': '0 12px 36px rgba(0, 0, 0, 0.35)',
      '--scrollbar': 'rgba(255, 255, 255, 0.18)',
      '--note': '#2c2c2e',
      '--note-local': '#2c2c2e',
      '--note-remote': '#243028',
      '--note-border': 'rgba(255, 255, 255, 0.08)',
      '--note-shadow': '0 2px 10px rgba(0, 0, 0, 0.25)',
      '--sidebar': '#000000',
      '--paper-line': 'rgba(255, 214, 10, 0.2)',
    },
  },
];

export function getTheme(id: ThemeId): ThemeDefinition {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}
