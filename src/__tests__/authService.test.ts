import { authService, DEMO_USER } from '../services/authService';

describe('Firebase Auth Service Tests', () => {
  beforeEach(() => {
    authService.loginDemoUser();
    jest.clearAllMocks();
  });

  it('should initialize with default demo user', () => {
    const user = authService.getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.email).toBe('thanh@smarthome.vn');
    expect(authService.isDemoMode()).toBe(true);
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('should manage API key correctly', () => {
    authService.setApiKey('AIzaSyTestApiKey123');
    expect(authService.getApiKey()).toBe('AIzaSyTestApiKey123');
  });

  it('should map Firebase errors to Vietnamese accurately', () => {
    expect(authService.mapAuthError('EMAIL_EXISTS')).toContain('Email này đã được đăng ký');
    expect(authService.mapAuthError('INVALID_PASSWORD')).toContain('Mật khẩu không chính xác');
    expect(authService.mapAuthError('INVALID_EMAIL')).toContain('Định dạng địa chỉ Email không hợp lệ');
    expect(authService.mapAuthError('WEAK_PASSWORD')).toContain('Mật khẩu quá yếu');
    expect(authService.mapAuthError('API_KEY_INVALID')).toContain('Firebase Web API Key không hợp lệ');
  });

  it('should sign out and update authentication state', () => {
    authService.signOut();
    expect(authService.getCurrentUser()).toBeNull();
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('should support subscribe listener callbacks on auth changes', () => {
    const mockListener = jest.fn();
    const unsubscribe = authService.subscribe(mockListener);

    expect(mockListener).toHaveBeenCalled();
    authService.signOut();
    expect(mockListener).toHaveBeenCalledWith(null);

    authService.loginDemoUser();
    expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({ email: 'thanh@smarthome.vn' }));

    unsubscribe();
  });

  it('should handle signIn with mock fetch success', async () => {
    (globalThis as any).fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            localId: 'firebase_uid_999',
            email: 'realuser@firebase.com',
            displayName: 'Real Firebase User',
            idToken: 'mock_jwt_id_token',
            refreshToken: 'mock_refresh_token',
            expiresIn: '3600',
          }),
      })
    );

    const user = await authService.signInWithEmail('realuser@firebase.com', 'mypassword', 'mock_key');
    expect(user.uid).toBe('firebase_uid_999');
    expect(user.email).toBe('realuser@firebase.com');
    expect(user.isDemo).toBe(false);
    expect(authService.isDemoMode()).toBe(false);
  });

  it('should handle signInWithGoogle with mock fetch success', async () => {
    (globalThis as any).fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            localId: 'google_uid_123',
            email: 'tu.smarthome@gmail.com',
            displayName: 'Tú SmartHome Admin',
            idToken: 'mock_google_jwt_token',
            refreshToken: 'mock_refresh_token',
            expiresIn: '3600',
          }),
      })
    );

    const user = await authService.signInWithGoogle('mock_id_token', 'mock_key');
    expect(user.uid).toBe('google_uid_123');
    expect(user.email).toBe('tu.smarthome@gmail.com');
    expect(user.displayName).toBe('Tú SmartHome Admin');
    expect(user.isDemo).toBe(false);
  });

  it('should load stored user from storage on app resume', async () => {
    const loadedUser = await authService.loadStoredUser();
    expect(loadedUser).not.toBeNull();
    expect(loadedUser?.email).toBe('tu.smarthome@gmail.com');
  });
});
