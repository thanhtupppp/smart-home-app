import { secureStorage } from './storageService';
import { AuthUser, AuthRole, FirebaseConfig } from '../types';

export interface AuthResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered?: boolean;
  displayName?: string;
}

export interface AuthError {
  code: string;
  message: string;
}

const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIREBASE_TOKEN_BASE_URL = 'https://securetoken.googleapis.com/v1';
const AUTH_STORAGE_KEY = 'tu_smarthome_auth_user';

// Default Demo User
export const DEMO_USER: AuthUser = {
  uid: 'demo_user_001',
  email: 'thanh@smarthome.vn',
  displayName: 'Nguyễn Văn Thành',
  role: 'owner',
  isDemo: true,
  lastLoginAt: new Date().toISOString(),
};

class AuthService {
  private currentUser: AuthUser | null = null;
  private apiKey: string = '';
  private authListeners: ((user: AuthUser | null) => void)[] = [];

  constructor() {
    this.currentUser = null;
  }

  public async loadStoredUser(): Promise<AuthUser | null> {
    try {
      const json = await secureStorage.getItem(AUTH_STORAGE_KEY);
      if (json) {
        const storedUser: AuthUser = JSON.parse(json);
        this.currentUser = storedUser;
        this.notifyListeners();
        return storedUser;
      }
    } catch {
      // Ignore corrupted or missing storage
    }
    return null;
  }

  private async persistUser(user: AuthUser | null) {
    try {
      if (user) {
        await secureStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        await secureStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore persistence errors
    }
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public isDemoMode(): boolean {
    return !this.currentUser || !!this.currentUser.isDemo;
  }

  public subscribe(callback: (user: AuthUser | null) => void): () => void {
    this.authListeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.authListeners = this.authListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners() {
    this.authListeners.forEach((cb) => cb(this.currentUser));
  }

  /**
   * Đăng nhập tài khoản Firebase thật bằng Email & Password
   */
  public async signInWithEmail(
    email: string,
    pass: string,
    customApiKey?: string
  ): Promise<AuthUser> {
    const key = customApiKey || this.apiKey;
    if (!key) {
      throw new Error('Chưa cấu hình Firebase Web API Key. Vui lòng nhập API Key trong Cài đặt Firebase.');
    }

    try {
      const response = await fetch(
        `${FIREBASE_AUTH_BASE_URL}/accounts:signInWithPassword?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password: pass,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(this.mapAuthError(data.error?.message || 'LOGIN_FAILED'));
      }

      let assignedRole: AuthRole = 'owner';
      let assignedName = data.displayName || data.email.split('@')[0];

      try {
        const dbUrl = 'https://tu-smart-home-1dcb8-default-rtdb.asia-southeast1.firebasedatabase.app';
        const membersRes = await fetch(`${dbUrl}/members.json?auth=${data.idToken}`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          if (membersData) {
            const memberList = Object.values(membersData) as any[];
            const matched = memberList.find(
              (m) => m.email && m.email.toLowerCase() === data.email.toLowerCase()
            );
            if (matched) {
              assignedRole = matched.role || 'member';
              if (matched.name) assignedName = matched.name;

              // Automatically mark member as activated in Firebase RTDB
              if (matched.id) {
                fetch(`${dbUrl}/members/${matched.id}.json?auth=${data.idToken}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    isActivated: true,
                    lastLoginAt: new Date().toISOString(),
                  }),
                }).catch(() => {});
              }
            }
          }
        }
      } catch {
        // Fallback
      }

      const authUser: AuthUser = {
        uid: data.localId,
        email: data.email,
        displayName: assignedName,
        role: assignedRole,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: parseInt(data.expiresIn, 10),
        lastLoginAt: new Date().toISOString(),
        isDemo: false,
      };

      this.currentUser = authUser;
      await this.persistUser(authUser);
      this.notifyListeners();
      return authUser;
    } catch (err: any) {
      throw new Error(err.message || 'Không thể kết nối đến máy chủ xác thực Firebase.');
    }
  }

  /**
   * Đăng nhập tài khoản Firebase bằng Google
   */
  public async signInWithGoogle(
    idTokenOrAuthCode?: string,
    customApiKey?: string
  ): Promise<AuthUser> {
    const key = customApiKey || this.apiKey;
    if (!key) {
      throw new Error('Chưa cấu hình Firebase Web API Key. Vui lòng kiểm tra lại cấu hình.');
    }

    if (!idTokenOrAuthCode) {
      throw new Error('Chưa nhận được mã xác thực Google OAuth Token.');
    }

    try {
      const response = await fetch(
        `${FIREBASE_AUTH_BASE_URL}/accounts:signInWithIdp?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postBody: `id_token=${encodeURIComponent(idTokenOrAuthCode)}&providerId=google.com`,
            requestUri: 'http://localhost',
            returnIdpCredential: true,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(this.mapAuthError(data.error?.message || 'GOOGLE_LOGIN_FAILED'));
      }

      let assignedRole: AuthRole = 'owner';
      let assignedName = data.displayName || data.email?.split('@')[0] || 'Google User';

      try {
        const dbUrl = 'https://tu-smart-home-1dcb8-default-rtdb.asia-southeast1.firebasedatabase.app';
        const membersRes = await fetch(`${dbUrl}/members.json?auth=${data.idToken}`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          if (membersData) {
            const memberList = Object.values(membersData) as any[];
            const matched = memberList.find(
              (m) => m.email && m.email.toLowerCase() === data.email?.toLowerCase()
            );
            if (matched) {
              assignedRole = matched.role || 'member';
              if (matched.name) assignedName = matched.name;

              // Automatically mark member as activated in Firebase RTDB
              if (matched.id) {
                fetch(`${dbUrl}/members/${matched.id}.json?auth=${data.idToken}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    isActivated: true,
                    lastLoginAt: new Date().toISOString(),
                  }),
                }).catch(() => {});
              }
            }
          }
        }
      } catch {
        // Fallback
      }

      const authUser: AuthUser = {
        uid: data.localId,
        email: data.email,
        displayName: assignedName,
        role: assignedRole,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: parseInt(data.expiresIn, 10),
        lastLoginAt: new Date().toISOString(),
        isDemo: false,
      };

      this.currentUser = authUser;
      await this.persistUser(authUser);
      this.notifyListeners();
      return authUser;
    } catch (err: any) {
      throw new Error(err.message || 'Không thể đăng nhập bằng tài khoản Google.');
    }
  }

  /**
   * Đăng ký tài khoản Firebase mới
   */
  public async signUpWithEmail(
    email: string,
    pass: string,
    displayName: string,
    role: AuthRole = 'owner',
    customApiKey?: string
  ): Promise<AuthUser> {
    const key = customApiKey || this.apiKey;
    if (!key) {
      throw new Error('Chưa cấu hình Firebase Web API Key. Vui lòng nhập API Key trong Cài đặt Firebase.');
    }

    try {
      const response = await fetch(
        `${FIREBASE_AUTH_BASE_URL}/accounts:signUp?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password: pass,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(this.mapAuthError(data.error?.message || 'SIGNUP_FAILED'));
      }

      // Update display name if provided
      if (displayName && data.idToken) {
        await this.updateProfile(data.idToken, displayName, key);
      }

      const authUser: AuthUser = {
        uid: data.localId,
        email: data.email,
        displayName: displayName.trim() || data.email.split('@')[0],
        role: role,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: parseInt(data.expiresIn, 10),
        lastLoginAt: new Date().toISOString(),
        isDemo: false,
      };

      this.currentUser = authUser;
      await this.persistUser(authUser);
      this.notifyListeners();
      return authUser;
    } catch (err: any) {
      throw new Error(err.message || 'Không thể đăng ký tài khoản với Firebase.');
    }
  }

  /**
   * Cập nhật thông tin profile (displayName)
   */
  public async updateProfile(idToken: string, displayName: string, customApiKey?: string): Promise<boolean> {
    const key = customApiKey || this.apiKey;
    if (!key) return false;

    try {
      const res = await fetch(`${FIREBASE_AUTH_BASE_URL}/accounts:update?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          displayName,
          returnSecureToken: true,
        }),
      });

      if (res.ok && this.currentUser) {
        this.currentUser = { ...this.currentUser, displayName };
        this.notifyListeners();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Gửi email khôi phục mật khẩu
   */
  public async sendPasswordResetEmail(email: string, customApiKey?: string): Promise<boolean> {
    const key = customApiKey || this.apiKey;
    if (!key) {
      throw new Error('Chưa cấu hình Firebase Web API Key.');
    }

    try {
      const response = await fetch(
        `${FIREBASE_AUTH_BASE_URL}/accounts:sendOobCode?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(this.mapAuthError(data.error?.message || 'RESET_FAILED'));
      }
      return true;
    } catch (err: any) {
      throw new Error(err.message || 'Không thể gửi email khôi phục mật khẩu.');
    }
  }

  /**
   * Làm mới ID Token khi hết hạn qua Refresh Token
   */
  public async refreshToken(customApiKey?: string): Promise<string | null> {
    if (!this.currentUser?.refreshToken) return null;
    const key = customApiKey || this.apiKey;
    if (!key) return null;

    try {
      const response = await fetch(`${FIREBASE_TOKEN_BASE_URL}/token?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${this.currentUser.refreshToken}`,
      });

      const data = await response.json();
      if (response.ok && data.id_token) {
        this.currentUser = {
          ...this.currentUser,
          idToken: data.id_token,
          refreshToken: data.refresh_token || this.currentUser.refreshToken,
          expiresIn: data.expires_in ? parseInt(data.expires_in, 10) : this.currentUser.expiresIn,
          lastLoginAt: new Date().toISOString(),
        };
        await this.persistUser(this.currentUser);
        this.notifyListeners();
        return data.id_token;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Trả về ID Token còn hiệu lực, tự động làm mới nếu sắp hết hạn (còn < 5 phút)
   */
  public async getValidIdToken(customApiKey?: string): Promise<string | null> {
    const user = this.currentUser;
    if (!user || user.isDemo) return null;
    if (!user.idToken) return null;

    // Tài khoản không có refreshToken (VD: demo) thì dùng token hiện có
    if (!user.refreshToken) return user.idToken;

    const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 phút
    const issuedAt = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
    const lifetimeMs = (user.expiresIn || 3600) * 1000;
    const expiresAt = issuedAt + lifetimeMs;

    if (issuedAt > 0 && Date.now() < expiresAt - REFRESH_THRESHOLD_MS) {
      return user.idToken; // Chưa cần làm mới
    }

    const freshToken = await this.refreshToken(customApiKey);
    return freshToken || user.idToken; // Fallback token cũ nếu refresh thất bại (có thể vẫn chưa hết hạn)
  }

  /**
   * Chuyển sang tài khoản Demo giả lập
   */
  public loginDemoUser(): AuthUser {
    this.currentUser = { ...DEMO_USER, lastLoginAt: new Date().toISOString() };
    this.notifyListeners();
    return this.currentUser;
  }

  /**
   * Đăng xuất tài khoản
   */
  public async signOut(): Promise<void> {
    this.currentUser = null;
    this.notifyListeners();
    await this.persistUser(null);
  }

  /**
   * Chuyển đổi mã lỗi Firebase thành thông điệp tiếng Việt dễ hiểu
   */
  public mapAuthError(firebaseError: string): string {
    if (firebaseError.includes('EMAIL_EXISTS')) {
      return 'Email này đã được đăng ký tài khoản trước đó.';
    }
    if (firebaseError.includes('EMAIL_NOT_FOUND')) {
      return 'Không tìm thấy tài khoản tương ứng với Email này.';
    }
    if (firebaseError.includes('INVALID_PASSWORD') || firebaseError.includes('INVALID_LOGIN_CREDENTIALS')) {
      return 'Mật khẩu không chính xác hoặc thông tin đăng nhập sai.';
    }
    if (firebaseError.includes('USER_DISABLED')) {
      return 'Tài khoản này đã bị tạm khóa bởi quản trị viên.';
    }
    if (firebaseError.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
      return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.';
    }
    if (firebaseError.includes('INVALID_EMAIL')) {
      return 'Định dạng địa chỉ Email không hợp lệ.';
    }
    if (firebaseError.includes('WEAK_PASSWORD')) {
      return 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu từ 6 ký tự trở lên.';
    }
    if (firebaseError.includes('API_KEY_INVALID') || firebaseError.includes('API key not valid')) {
      return 'Firebase Web API Key không hợp lệ. Vui lòng kiểm tra lại trong mục Cấu hình.';
    }
    return `Lỗi xác thực Firebase: ${firebaseError}`;
  }
}

export const authService = new AuthService();
