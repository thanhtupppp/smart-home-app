import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  NeuStyles,
} from "../theme";
import { useHome } from "../context/HomeContext";
import { Header } from "../components/Header";
import { EnvironmentalCockpit } from "../components/EnvironmentalCockpit";
import { SectionHeader } from "../components/SectionHeader";
import { QuickSceneButton } from "../components/QuickSceneButton";
import { DeviceCard } from "../components/DeviceCard";
import { RoomCard } from "../components/RoomCard";
import { Device, Scene } from "../types";
import { AppNavigationProp } from "../navigation/types";

// Type guard for devices with dedicated detail controller screens
const isControllableDevice = (
  dev: Device
): dev is Device & { type: "rgb_light" | "ac" | "camera" } => {
  return ["rgb_light", "ac", "camera"].includes(dev.type);
};

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { overview, devices, rooms, scenes, toggleDevice, activateScene } =
    useHome();

  const favoriteDevices = useMemo(
    () => devices.filter((d) => d.isFavorite),
    [devices]
  );

  const handleDeviceDetail = useCallback(
    (dev: Device) => {
      if (dev.type === "rgb_light") {
        navigation.navigate("RGBController", { deviceId: dev.id });
      } else if (dev.type === "ac") {
        navigation.navigate("ACController", { deviceId: dev.id });
      } else if (dev.type === "camera") {
        navigation.navigate("CameraDetail");
      }
    },
    [navigation]
  );

  const renderSceneItem = useCallback(
    ({ item }: { item: Scene }) => (
      <QuickSceneButton
        scene={item}
        onPress={activateScene}
      />
    ),
    [activateScene]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        subtitle="Tổng quan Nhà thông minh"
        title={overview.homeName}
        onNotificationPress={() => navigation.navigate("HistoryAlert")}
        onSettingsPress={() => navigation.navigate("FirebaseConfig")}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Modular Environmental & Energy Status Banner */}
        <EnvironmentalCockpit overview={overview} />

        {/* 2. Quick Scenes */}
        <SectionHeader
          title="Kịch bản nhanh"
          actionLabel="Tất cả"
          onPress={() => navigation.navigate("Automation")}
          accessibilityLabel="Xem tất cả kịch bản tự động hóa"
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scenesScroll}
          contentContainerStyle={styles.scenesContainer}
          data={scenes}
          keyExtractor={(item) => item.id}
          renderItem={renderSceneItem}
        />

        {/* 3. Favorite Devices */}
        <SectionHeader
          title="Thiết bị yêu thích"
          actionLabel={`Xem (${devices.length})`}
          onPress={() => navigation.navigate("Devices")}
          accessibilityLabel="Xem tất cả thiết bị"
        />

        {favoriteDevices.length > 0 ? (
          <View style={styles.devicesGrid}>
            {favoriteDevices.map((dev) => (
              <DeviceCard
                key={dev.id}
                device={dev}
                onToggle={() => toggleDevice(dev.id)}
                onPressDetail={
                  isControllableDevice(dev)
                    ? () => handleDeviceDetail(dev)
                    : undefined
                }
              />
            ))}
          </View>
        ) : (
          <View style={[styles.emptyFavoriteBox, NeuStyles.cavity]}>
            <MaterialIcons name="star-outline" size={28} color="#94A3B8" />
            <Text style={[Typography.bodyMedium, styles.emptyFavoriteTitle]}>
              Chưa có thiết bị yêu thích
            </Text>
            <Text style={styles.emptyFavoriteDesc}>
              Đánh dấu sao các thiết bị thường dùng để hiển thị nhanh tại đây.
            </Text>
          </View>
        )}

        {/* 4. Rooms Section */}
        <SectionHeader
          title="Khu vực phòng"
          actionLabel="Quản lý"
          onPress={() => navigation.navigate("Rooms")}
          accessibilityLabel="Quản lý khu vực phòng"
        />

        <View style={styles.roomsGrid}>
          {rooms.map((room) => (
            <View key={room.id} style={styles.roomGridItem}>
              <RoomCard
                room={room}
                onPress={() =>
                  navigation.navigate("RoomDetail", { roomId: room.id })
                }
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E8ECF2",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  scenesScroll: {
    marginBottom: 20,
    marginHorizontal: -Spacing.marginMobile,
  },
  scenesContainer: {
    paddingHorizontal: Spacing.marginMobile,
  },
  devicesGrid: {
    marginBottom: 10,
  },
  emptyFavoriteBox: {
    padding: 20,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyFavoriteTitle: {
    color: "#334155",
    fontWeight: "700",
    marginTop: 6,
  },
  emptyFavoriteDesc: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  roomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
    marginBottom: 20,
  },
  roomGridItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
});
