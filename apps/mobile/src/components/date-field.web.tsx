import { useColorScheme } from 'react-native';

import type { DateFieldProps } from '@/components/date-field';
import { useColors } from '@/constants/theme';

// Web app version of DateField: the browser's built-in date picker (a calendar on computers,
// the phone's date wheel in mobile browsers). Dates are read and written in the phone's own
// time zone, like the app's other screens.

const pad = (n: number) => String(n).padStart(2, '0');
const dayText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toInput = (d: Date, mode: DateFieldProps['mode']) =>
  mode === 'date' ? dayText(d) : `${dayText(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function fromInput(text: string, mode: DateFieldProps['mode'], previous: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // A date-only pick keeps the time of day it had before, like the phone's picker.
  const hours = mode === 'date' ? previous.getHours() : Number(h ?? 0);
  const minutes = mode === 'date' ? previous.getMinutes() : Number(mi ?? 0);
  return new Date(Number(y), Number(mo) - 1, Number(d), hours, minutes);
}

export function DateField({ value, mode, minimumDate, maximumDate, onChange }: DateFieldProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  return (
    <input
      type={mode === 'date' ? 'date' : 'datetime-local'}
      value={toInput(value, mode)}
      min={minimumDate ? toInput(minimumDate, mode) : undefined}
      max={maximumDate ? toInput(maximumDate, mode) : undefined}
      onChange={(e) => {
        const next = fromInput(e.currentTarget.value, mode, value);
        if (!next) return;
        // Keep within the allowed range, as the phone's picker does.
        if (minimumDate && next < minimumDate) return onChange(minimumDate);
        if (maximumDate && next > maximumDate) return onChange(maximumDate);
        onChange(next);
      }}
      style={{
        font: 'inherit',
        fontSize: 15,
        fontWeight: 600,
        color: colors.text,
        background: colors.raised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: '6px 8px',
        colorScheme: scheme === 'dark' ? 'dark' : 'light',
        accentColor: colors.accent,
      }}
    />
  );
}
