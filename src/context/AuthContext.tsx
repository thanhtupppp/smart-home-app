import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthUser, AuthRole } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  login: (email: string, pass: string, customApiKey?: string) => Promise<AuthUser>;
  loginWithGoogle: (idToken?: string, customApiKey?: string) => Promise<AuthUser>;
  register: (
    email: string,
    pass: string,
    displayName: string,
    customApiKey?: string
  ) => Promise<AuthUser>;
  loginDemo: () => AuthUser;
  logout: () => Promise<void>;
  resetPassword: (email: string, customApiKey?: string) => Promise<boolean>;
  updateProfile: (displayName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    authService.loadStoredUser().finally(() => {
      if (isMounted) {
        setIsInitializing(false);
      }
    });

    const unsubscribe = authService.subscribe((newUser) => {
      setUser(newUser);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, pass: string, customApiKey?: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const authUser = await authService.signInWithEmail(email, pass, customApiKey);
      return authUser;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (idToken?: string, customApiKey?: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const authUser = await authService.signInWithGoogle(idToken, customApiKey);
      return authUser;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (
    email: string,
    pass: string,
    displayName: string,
    customApiKey?: string
  ): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      // Role không được nhận từ client — luôn là 'member', owner bootstrap khi tạo nhà
      const authUser = await authService.signUpWithEmail(email, pass, displayName, customApiKey);
      return authUser;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginDemo = useCallback((): AuthUser => {
    return authService.loginDemoUser();
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Xóa home cache & local storage trước khi signOut để không leak data giữa sessions
    const { firebaseService } = await import('../services/firebaseService');
    const { safeStorage } = await import('../services/storageService');
    await firebaseService.clearActiveHome();
    await safeStorage.clear();
    await authService.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string, customApiKey?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      return await authService.sendPasswordResetEmail(email, customApiKey);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (displayName: string): Promise<boolean> => {
    if (!user?.idToken) return false;
    return await authService.updateProfile(user.idToken, displayName);
  }, [user?.idToken]);

  const isAuthenticated = user !== null;
  const isDemoMode = !user || !!user.isDemo;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated,
      isDemoMode,
      isLoading,
      isInitializing,
      login,
      loginWithGoogle,
      register,
      loginDemo,
      logout,
      resetPassword,
      updateProfile,
    }),
    [
      user,
      isAuthenticated,
      isDemoMode,
      isLoading,
      isInitializing,
      login,
      loginWithGoogle,
      register,
      loginDemo,
      logout,
      resetPassword,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

