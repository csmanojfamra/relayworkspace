export type ThemeId =
  | 'modern-dark'
  | 'linux-green'
  | 'amber-crt'
  | 'blue-terminal'
  | 'white-terminal';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  vars: Record<string, string>;
}

export const themes: ThemeDefinition[] = [
  {
    id: 'modern-dark',
    label: 'Modern Dark',
    vars: {
      '--bg': '#0a0a0b',
      '--bg-elevated': '#111214',
      '--bg-soft': '#16181c',
      '--panel': 'rgba(17, 18, 20, 0.86)',
      '--border': 'rgba(255, 255, 255, 0.08)',
      '--border-strong': 'rgba(255, 255, 255, 0.14)',
      '--text': '#e8eaed',
      '--text-muted': '#8b919a',
      '--text-faint': '#5c6370',
      '--accent': '#7cffb2',
      '--accent-soft': 'rgba(124, 255, 178, 0.12)',
      '--danger': '#ff6b7a',
      '--warning': '#f5c542',
      '--me': '#9ad4ff',
      '--peer': '#7cffb2',
      '--cursor': '#7cffb2',
      '--glow': 'rgba(124, 255, 178, 0.18)',
      '--shadow': '0 24px 80px rgba(0, 0, 0, 0.45)',
      '--scrollbar': 'rgba(255, 255, 255, 0.12)',
    },
  },
  {
    id: 'linux-green',
    label: 'Linux Green',
    vars: {
      '--bg': '#070b07',
      '--bg-elevated': '#0c120c',
      '--bg-soft': '#101910',
      '--panel': 'rgba(12, 18, 12, 0.9)',
      '--border': 'rgba(96, 255, 128, 0.12)',
      '--border-strong': 'rgba(96, 255, 128, 0.22)',
      '--text': '#d7ffe0',
      '--text-muted': '#6f9f7a',
      '--text-faint': '#4a6d52',
      '--accent': '#39ff14',
      '--accent-soft': 'rgba(57, 255, 20, 0.12)',
      '--danger': '#ff5d6c',
      '--warning': '#ffe066',
      '--me': '#9dffa8',
      '--peer': '#39ff14',
      '--cursor': '#39ff14',
      '--glow': 'rgba(57, 255, 20, 0.16)',
      '--shadow': '0 24px 80px rgba(0, 0, 0, 0.5)',
      '--scrollbar': 'rgba(57, 255, 20, 0.18)',
    },
  },
  {
    id: 'amber-crt',
    label: 'Amber CRT',
    vars: {
      '--bg': '#100c06',
      '--bg-elevated': '#181108',
      '--bg-soft': '#1f160a',
      '--panel': 'rgba(24, 17, 8, 0.92)',
      '--border': 'rgba(255, 176, 64, 0.14)',
      '--border-strong': 'rgba(255, 176, 64, 0.24)',
      '--text': '#ffd59a',
      '--text-muted': '#b8844a',
      '--text-faint': '#7a5730',
      '--accent': '#ffb040',
      '--accent-soft': 'rgba(255, 176, 64, 0.14)',
      '--danger': '#ff6b57',
      '--warning': '#ffd166',
      '--me': '#ffc978',
      '--peer': '#ffb040',
      '--cursor': '#ffb040',
      '--glow': 'rgba(255, 176, 64, 0.18)',
      '--shadow': '0 24px 80px rgba(0, 0, 0, 0.5)',
      '--scrollbar': 'rgba(255, 176, 64, 0.2)',
    },
  },
  {
    id: 'blue-terminal',
    label: 'Blue Console',
    vars: {
      '--bg': '#070a12',
      '--bg-elevated': '#0c1220',
      '--bg-soft': '#111a2c',
      '--panel': 'rgba(12, 18, 32, 0.9)',
      '--border': 'rgba(120, 170, 255, 0.14)',
      '--border-strong': 'rgba(120, 170, 255, 0.24)',
      '--text': '#d7e6ff',
      '--text-muted': '#7f97c2',
      '--text-faint': '#536588',
      '--accent': '#6ea8ff',
      '--accent-soft': 'rgba(110, 168, 255, 0.14)',
      '--danger': '#ff6b7a',
      '--warning': '#f5c542',
      '--me': '#9ec3ff',
      '--peer': '#6ea8ff',
      '--cursor': '#6ea8ff',
      '--glow': 'rgba(110, 168, 255, 0.18)',
      '--shadow': '0 24px 80px rgba(0, 0, 0, 0.48)',
      '--scrollbar': 'rgba(110, 168, 255, 0.2)',
    },
  },
  {
    id: 'white-terminal',
    label: 'Light Console',
    vars: {
      '--bg': '#f4f5f7',
      '--bg-elevated': '#ffffff',
      '--bg-soft': '#eceef2',
      '--panel': 'rgba(255, 255, 255, 0.92)',
      '--border': 'rgba(15, 23, 42, 0.08)',
      '--border-strong': 'rgba(15, 23, 42, 0.14)',
      '--text': '#15181f',
      '--text-muted': '#667085',
      '--text-faint': '#98a2b3',
      '--accent': '#0f766e',
      '--accent-soft': 'rgba(15, 118, 110, 0.1)',
      '--danger': '#d92d20',
      '--warning': '#b54708',
      '--me': '#175cd3',
      '--peer': '#0f766e',
      '--cursor': '#0f766e',
      '--glow': 'rgba(15, 118, 110, 0.12)',
      '--shadow': '0 24px 80px rgba(15, 23, 42, 0.08)',
      '--scrollbar': 'rgba(15, 23, 42, 0.16)',
    },
  },
];

export function getTheme(id: ThemeId): ThemeDefinition {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}
