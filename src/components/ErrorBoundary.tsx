import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, BorderRadius, NeuStyles } from '../theme';

import { sentryService } from '../services/sentryService';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    sentryService.captureException(error, { componentStack: errorInfo.componentStack });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={[styles.card, NeuStyles.raised]}>
            <View style={[styles.iconBox, NeuStyles.cavity]}>
              <Ionicons name="warning-outline" size={36} color="#EF4444" />
            </View>

            <Text style={[Typography.titleMedium, styles.title]}>
              Đã xảy ra sự cố
            </Text>
            <Text style={styles.message}>
              {this.props.fallbackMessage ||
                'Ứng dụng gặp lỗi khi tải thành phần này. Vui lòng thử tải lại.'}
            </Text>

            <TouchableOpacity
              style={[styles.retryBtn, NeuStyles.raisedSoft]}
              onPress={this.handleReset}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={16} color="#2563EB" />
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8ECF2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 24,
    borderRadius: BorderRadius.xxl,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
  },
  message: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
  },
  retryText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 14,
  },
});
