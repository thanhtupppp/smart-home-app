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

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { resetPassword, isLoading } = useAuth();
  const { firebaseConfig } = useHome();

  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState(firebaseConfig.apiKey || '');
  const [isSent, setIsSent] = useState(false);

  const handleReset = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Thiếu Email', 'Vui lòng nhập địa chỉ Email đăng ký tài khoản của bạn.');
      return;
    }

    try {
      await resetPassword(email.trim(), apiKey.trim() || undefined);
      setIsSent(true);
    } catch (err: any) {
      Alert.alert('Không thể gửi yêu cầu', err.message || 'Vui lòng kiểm tra lại email.');
    }
  }, [email, apiKey, resetPassword]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.backBtn, NeuStyles.raised]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text style={[Typography.titleMedium, styles.topBarTitle]}>Khôi phục mật khẩu</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, NeuStyles.raised]}>
            <View style={[styles.iconCircle, NeuStyles.cavity]}>
              <Ionicons name="key-outline" size={32} color="#2563EB" />
            </View>

            <Text style={[Typography.headlineSmall, styles.title]}>Quên mật khẩu?</Text>
            <Text style={styles.subtitle}>
              Nhập email đã đăng ký. Hệ thống Firebase Auth sẽ gửi một liên kết an toàn vào hộp thư để bạn đặt lại mật khẩu mới.
            </Text>

            {isSent ? (
              <View style={[styles.successBox, NeuStyles.cavity]}>
                <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                <Text style={styles.successTitle}>Đã gửi liên kết khôi phục!</Text>
                <Text style={styles.successText}>
                  Vui lòng kiểm tra hộp thư đến (và thư mục rác/spam) của {email} để tiếp tục.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, NeuStyles.raised, { marginTop: 16 }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.primaryBtnText}>Quay lại Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
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

                <TouchableOpacity
                  style={[styles.primaryBtn, NeuStyles.raised]}
                  onPress={handleReset}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Gửi liên kết khôi phục"
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={styles.btnContent}>
                      <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Gửi liên kết khôi phục</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
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
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 20,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 19,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    alignSelf: 'flex-start',
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    height: 48,
    width: '100%',
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
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: BorderRadius.xl,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
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
  successBox: {
    width: '100%',
    padding: 20,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 10,
  },
  successText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
