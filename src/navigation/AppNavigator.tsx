import React from 'react';
import { Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, NeuStyles, NeuPalette } from '../theme';
import { RootStackParamList, BottomTabParamList } from './types';
import { useAuth } from '../context/AuthContext';

// Screens
import { DashboardScreen } from '../screens/DashboardScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { RoomsScreen } from '../screens/RoomsScreen';
import { RoomDetailScreen } from '../screens/RoomDetailScreen';
import { AutomationScreen } from '../screens/AutomationScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RGBControllerScreen } from '../screens/RGBControllerScreen';
import { ACControllerScreen } from '../screens/ACControllerScreen';
import { HistoryAlertScreen } from '../screens/HistoryAlertScreen';
import { AddDeviceScreen } from '../screens/AddDeviceScreen';
import { FirebaseConfigScreen } from '../screens/FirebaseConfigScreen';
import { ManageHomeScreen } from '../screens/ManageHomeScreen';
import { MemberRolesScreen } from '../screens/MemberRolesScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { CameraDetailScreen } from '../screens/CameraDetailScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#E8ECF2',
          borderTopWidth: 1.5,
          borderTopColor: 'rgba(255, 255, 255, 0.9)',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: '#9EADBF',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
            },
            android: {
              elevation: 10,
            },
            default: {
              boxShadow: '0 -4px 14px rgba(158, 173, 191, 0.35)',
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Tổng quan',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={21} color={focused ? '#2563EB' : color} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Devices"
        component={DevicesScreen}
        options={{
          tabBarLabel: 'Thiết bị',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
              <Ionicons name={focused ? 'hardware-chip' : 'hardware-chip-outline'} size={21} color={focused ? '#2563EB' : color} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Rooms"
        component={RoomsScreen}
        options={{
          tabBarLabel: 'Phòng',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={21} color={focused ? '#2563EB' : color} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Automation"
        component={AutomationScreen}
        options={{
          tabBarLabel: 'Tự động',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
              <Ionicons name={focused ? 'flash' : 'flash-outline'} size={21} color={focused ? '#2563EB' : color} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Cài đặt',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={21} color={focused ? '#2563EB' : color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#E8ECF2', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={user ? 'MainTabs' : 'Login'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#E8ECF2' },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="RoomDetail" component={RoomDetailScreen} />
          <Stack.Screen name="RGBController" component={RGBControllerScreen} />
          <Stack.Screen name="ACController" component={ACControllerScreen} />
          <Stack.Screen name="CameraDetail" component={CameraDetailScreen} />
          <Stack.Screen name="HistoryAlert" component={HistoryAlertScreen} />
          <Stack.Screen name="AddDevice" component={AddDeviceScreen} />
          <Stack.Screen name="FirebaseConfig" component={FirebaseConfigScreen} />
          <Stack.Screen name="ManageHome" component={ManageHomeScreen} />
          <Stack.Screen name="MemberRoles" component={MemberRolesScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIconWrap: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  tabIconActive: {
    backgroundColor: '#DFE5EE',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(160, 175, 195, 0.4)',
    borderLeftColor: 'rgba(160, 175, 195, 0.4)',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: '#FFFFFF',
    borderRightColor: '#FFFFFF',
  },
});
