import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
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
import { AuthRole } from '../types';

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { register, isLoading } = useAuth();
  const { firebaseConfig } = useHome();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<AuthRole>('owner');
  const [showPassword, setShowPassword] = useState(false);
  const [apiKey, setApiKey] = useState(firebaseConfig.apiKey || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần có ít nhất 6 ký tự để đảm bảo an toàn.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    try {
      await register(
        email,
        password,
        displayName.trim(),
        role,
        apiKey.trim() || undefined
      );

      Alert.alert(
        'Đăng ký thành công',
        `Chào mừng ${displayName} gia nhập hệ thống Smart Home!`,
        [
          {
            text: 'Bắt đầu ngay',
            onPress: () => {
              (navigation as any).reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Đăng ký thất bại', err.message || 'Không thể tạo tài khoản.');
    }
  }, [displayName, email, password, confirmPassword, role, apiKey, register, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* Top bar with back button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.backBtn, NeuStyles.raised]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text style={[Typography.titleMedium, styles.topBarTitle]}>Tạo tài khoản mới</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, NeuStyles.raised]}>
            <Text style={[Typography.headlineSmall, styles.formTitle]}>Đăng ký Firebase</Text>
            <Text style={styles.formSubtitle}>
              Tài khoản sẽ được đồng bộ và phân quyền trực tiếp trên Firebase Cloud.
            </Text>

            {/* Display Name Field */}
            <Text style={styles.label}>Họ và tên</Text>
            <View style={[styles.inputContainer, NeuStyles.cavity]}>
              <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Nguyễn Văn A"
                placeholderTextColor="#94A3B8"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            {/* Email Field */}
            <Text style={styles.label}>Email</Text>
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
            <Text style={styles.label}>Mật khẩu (Tối thiểu 6 ký tự)</Text>
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
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Field */}
            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <View style={[styles.inputContainer, NeuStyles.cavity]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            {/* Role Selection */}
            <Text style={styles.label}>Vai trò trong nhà</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === 'owner' ? styles.roleActive : NeuStyles.cavity,
                ]}
                onPress={() => setRole('owner')}
              >
                <Ionicons
                  name="shield-outline"
                  size={20}
                  color={role === 'owner' ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.roleName,
                    role === 'owner' && { color: '#2563EB', fontWeight: '800' },
                  ]}
                >
                  Chủ nhà (Admin)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === 'member' ? styles.roleActive : NeuStyles.cavity,
                ]}
                onPress={() => setRole('member')}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={role === 'member' ? '#2563EB' : '#64748B'}
                />
                <Text
                  style={[
                    styles.roleName,
                    role === 'member' && { color: '#2563EB', fontWeight: '800' },
                  ]}
                >
                  Thành viên
                </Text>
              </TouchableOpacity>
            </View>

            {/* Custom API Key Collapsible */}
            <TouchableOpacity
              onPress={() => setShowApiKeyInput(!showApiKeyInput)}
              style={styles.apiKeyToggle}
            >
              <Ionicons
                name={showApiKeyInput ? 'chevron-down' : 'chevron-forward'}
                size={14}
                color="#2563EB"
              />
              <Text style={styles.apiKeyToggleText}>
                {apiKey ? 'API Key: Đã lưu cấu hình' : 'Tùy chỉnh Firebase Web API Key'}
              </Text>
            </TouchableOpacity>

            {showApiKeyInput && (
              <View style={[styles.inputContainer, NeuStyles.cavity, { marginTop: 8 }]}>
                <Ionicons name="key-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="AIzaSy..."
                  placeholderTextColor="#94A3B8"
                  value={apiKey}
                  onChangeText={setApiKey}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, NeuStyles.raised]}
              onPress={handleRegister}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Đăng ký tài khoản"
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Đăng ký tài khoản</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Back to Login link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản?</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Đăng nhập ngay</Text>
            </TouchableOpacity>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  card: {
    borderRadius: BorderRadius.xxl,
    padding: 20,
    marginBottom: 20,
  },
  formTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 20,
  },
  formSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
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
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    gap: 8,
  },
  roleActive: {
    backgroundColor: '#DFE5EE',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  roleName: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  apiKeyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  apiKeyToggleText: {
    fontSize: 11,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  loginLink: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '800',
  },
});
