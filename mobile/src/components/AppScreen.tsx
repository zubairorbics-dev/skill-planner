import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface AppScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  backgroundColor?: string;
}

/** Consistent safe-area shell so content never sticks under the status bar. */
export const AppScreen: React.FC<AppScreenProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = colors.bg,
}) => {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? Math.max(insets.top, 12) : 0,
    paddingBottom: edges.includes('bottom') ? Math.max(insets.bottom, 8) : 0,
    paddingLeft: edges.includes('left') ? Math.max(insets.left, 0) : 0,
    paddingRight: edges.includes('right') ? Math.max(insets.right, 0) : 0,
  };

  return (
    <View style={[styles.root, { backgroundColor }, pad, style]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
