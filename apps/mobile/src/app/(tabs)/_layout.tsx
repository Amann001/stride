import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/constants/categories';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

interface TabIconProps {
  color: ColorValue;
  size: number;
  focused: boolean;
}

const icon = (name: IconName, focusedName: IconName = name) =>
  function TabIcon({ color, size, focused }: TabIconProps) {
    return <MaterialCommunityIcons name={focused ? focusedName : name} color={color} size={size} />;
  };

// The "You" tab shows your initial in a circle, like a profile photo.
function AvatarIcon({ color, focused }: TabIconProps) {
  const colors = useColors();
  const { user } = useAuth();
  return (
    <View style={[styles.avatar, { backgroundColor: focused ? colors.brand : colors.border, borderColor: color }]}>
      <Text style={[styles.avatarText, { color: focused ? colors.onBrand : colors.text }]}>
        {user?.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// The bottom tab bar: Home, Maps, Record, Groups, You. Each screen draws its own header.
export default function TabsLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // In a browser the standard bar is a little too short for the labels under the icons, and
  // an installed iPhone web app needs room for the home bar.
  const webBar = Platform.OS === 'web' ? { height: 60 + insets.bottom, paddingTop: 4, paddingBottom: 6 + insets.bottom } : null;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, ...webBar },
        tabBarLabelStyle: { fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="maps" options={{ title: 'Maps', tabBarIcon: icon('map-outline', 'map') }} />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: icon('record-circle-outline', 'record-circle'),
          // Recording is full screen, like Strava. The screen has its own close button.
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="groups" options={{ title: 'Groups', tabBarIcon: icon('account-group-outline', 'account-group') }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: AvatarIcon }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarText: { fontSize: 12, fontWeight: '700' },
});
