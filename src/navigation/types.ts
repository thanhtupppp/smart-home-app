import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';

export type BottomTabParamList = {
  Dashboard: undefined;
  Devices: undefined;
  Rooms: undefined;
  Automation: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  RoomDetail: { roomId: string };
  RGBController: { deviceId: string };
  ACController: { deviceId: string };
  CameraDetail: undefined;
  HistoryAlert: undefined;
  AddDevice: undefined;
  FirebaseConfig: undefined;
  ManageHome: undefined;
  MemberRoles: undefined;
  NotificationSettings: undefined;
};

export type AppNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
