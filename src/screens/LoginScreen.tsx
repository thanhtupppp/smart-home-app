import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../context/HomeContext';
import { AppNavigationProp } from '../navigation/types';
import { appConfig } from '../config/appConfig';

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { login, loginWithGoogle, loginDemo, isLoading } = useAuth();
  const { firebaseConfig } = useHome();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      await login(email, password, firebaseConfig.apiKey || undefined);
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (err: any) {
      Alert.alert('Đăng nhập thất bại', err.message || 'Vui lòng kiểm tra lại thông tin đăng nhập.');
    }
  }, [email, password, firebaseConfig.apiKey, login, navigation]);

  // Lấy từ biến môi trường EXPO_PUBLIC_GOOGLE_CLIENT_ID trong file .env
  const GOOGLE_CLIENT_ID = appConfig.googleClientId;

  const handleGoogleLogin = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert(
        'Chưa cấu hình Google',
        'Google Client ID chưa được cấu hình. Vui lòng thêm EXPO_PUBLIC_GOOGLE_CLIENT_ID vào file .env (xem .env.example).'
      );
      return;
    }
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'tusmarthome',
      });

      const nonce = Crypto.randomUUID();
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=id_token%20token&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&nonce=${nonce}&prompt=select_account`;

      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        // Parse id_token from returned OAuth redirect URL fragment/query
        const tokenMatch = result.url.match(/id_token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
          await loginWithGoogle(decodeURIComponent(tokenMatch[1]), firebaseConfig.apiKey || undefined);
          (navigation as any).reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
          return;
        }
      }
    } catch (err: any) {
      Alert.alert(
        'Đăng nhập Google',
        err.message || 'Không thể đăng nhập bằng tài khoản Google. Vui lòng thử lại.'
      );
    }
  }, [GOOGLE_CLIENT_ID, firebaseConfig.apiKey, loginWithGoogle, navigation]);

  const handleDemoLogin = useCallback(() => {
    loginDemo();
    (navigation as any).reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  }, [loginDemo, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={[styles.logoBox, NeuStyles.circleRaised]}>
              <Ionicons name="home" size={38} color="#2563EB" />
            </View>
            <Text style={[Typography.headlineMedium, styles.appTitle]}>Tú SmartHome</Text>
            <Text style={[Typography.bodyMedium, styles.appSubtitle]}>
              Hệ thống điều khiển nhà thông minh
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, NeuStyles.raised]}>
            <Text style={[Typography.titleMedium, styles.formTitle]}>Đăng nhập</Text>

            {/* Email Field */}
            <Text style={styles.label}>Email tài khoản</Text>
            <View style={[styles.inputContainer, NeuStyles.cavity]}>
              <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="example@domain.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={[styles.inputContainer, NeuStyles.cavity]}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {/* Forgot password */}
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </Pressable>

            {/* Login Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                NeuStyles.raised,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Đăng nhập"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Đăng nhập</Text>
                </View>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-in Button */}
            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                NeuStyles.raised,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleGoogleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Đăng nhập bằng Google"
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.googleBtnText}>Đăng nhập bằng Google</Text>
            </Pressable>

            {/* Demo Mode Button */}
            <Pressable
              style={({ pressed }) => [
                styles.demoBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleDemoLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Dùng thử chế độ Demo"
            >
              <Ionicons name="sparkles-outline" size={18} color="#2563EB" />
              <Text style={styles.demoBtnText}>Dùng thử chế độ Demo</Text>
            </Pressable>
          </View>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Chưa có tài khoản?</Text>
            <Pressable
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Đăng ký tài khoản mới"
            >
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8ECF2',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 24,
  },
  appSubtitle: {
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontSize: 13,
  },
  card: {
    borderRadius: BorderRadius.xxl,
    padding: 20,
    marginBottom: 20,
  },
  formTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: BorderRadius.xl,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    marginHorizontal: 10,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
    height: 48,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  googleBtnText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 14,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
    height: 48,
    marginTop: 12,
    gap: 10,
  },
  demoBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 14,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  registerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  registerLink: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '800',
  },
});
