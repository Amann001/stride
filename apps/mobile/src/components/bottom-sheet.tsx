import { useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { useColors } from '@/constants/theme';

// A panel that sits over the bottom of the map and can be dragged between a few heights,
// like the route list on Strava's map. Drag it by the top strip (handle and header).
export function BottomSheet({ heights, header, children, initialIndex = 0 }: {
  // The heights it snaps to, smallest first, in points.
  heights: number[];
  header?: ReactNode;
  children: ReactNode;
  initialIndex?: number;
}) {
  const colors = useColors();
  const tallest = heights[heights.length - 1];

  // Set up once. The sheet is always `tallest` high; sliding it down hides the rest below
  // the screen. The drag bookkeeping lives in this closure.
  const [{ translate, pan }] = useState(() => {
    const offsetFor = (i: number) => tallest - heights[i];
    const value = new Animated.Value(offsetFor(initialIndex));
    let index = initialIndex;
    let dragStart = 0;

    const snapTo = (i: number) => {
      index = i;
      Animated.spring(value, { toValue: offsetFor(i), useNativeDriver: true, bounciness: 2, speed: 16 }).start();
    };

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        value.stopAnimation((v) => {
          dragStart = v;
        });
      },
      onPanResponderMove: (_, g) => {
        value.setValue(Math.max(0, Math.min(offsetFor(0), dragStart + g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const position = dragStart + g.dy;
        let i = index;
        if (Math.abs(g.dy) < 6) {
          // A tap on the handle: open one step, or close if already fully open.
          i = i === heights.length - 1 ? 0 : i + 1;
        } else if (g.vy < -0.5) {
          i = Math.min(heights.length - 1, i + 1);
        } else if (g.vy > 0.5) {
          i = Math.max(0, i - 1);
        } else {
          // Otherwise settle at the nearest height.
          i = heights.map((_, k) => k).reduce((best, k) =>
            Math.abs(offsetFor(k) - position) < Math.abs(offsetFor(best) - position) ? k : best, 0);
        }
        snapTo(i);
      },
    });
    return { translate: value, pan: responder };
  });

  return (
    <Animated.View
      style={[styles.sheet, { height: tallest, backgroundColor: colors.card, transform: [{ translateY: translate }] }]}>
      <View {...pan.panHandlers} style={styles.grab}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {header}
      </View>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: -2 },
  },
  grab: { paddingTop: 8, paddingBottom: 6 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  body: { flex: 1 },
});
