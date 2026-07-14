import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export type ThemedViewProps = ViewProps & {
  type?: 'bg' | 'surface' | 'surfaceSunken';
};

export function ThemedView({ style, type = 'bg', ...otherProps }: ThemedViewProps) {
  const { colors } = useTheme();

  return <View style={[{ backgroundColor: colors[type] }, style]} {...otherProps} />;
}
