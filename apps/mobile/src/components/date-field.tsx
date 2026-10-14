import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from 'react-native';

import { useColors } from '@/constants/theme';

// A date (or date and time) picker for forms. On the phone it's the system picker, as before;
// date-field.web.tsx is the web app's version, using the browser's own date picker.

export interface DateFieldProps {
  value: Date;
  mode: 'date' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (date: Date) => void;
}

export function DateField({ value, mode, minimumDate, maximumDate, onChange }: DateFieldProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  return (
    <DateTimePicker
      value={value}
      mode={mode}
      display="compact"
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      accentColor={colors.accent}
      themeVariant={scheme === 'dark' ? 'dark' : 'light'}
      onValueChange={(_, d) => onChange(d)}
    />
  );
}
