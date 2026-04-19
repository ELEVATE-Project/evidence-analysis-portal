import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { registerAuthHandlers } from '../services/api';
import {
  REFRESH_BUFFER_MS,
  clearStoredSession,
  getStoredSession,
  isNearExpiry,
  persistSession,
  resolveExpiresAt,
} from '../services/authStorage';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refreshTimeoutRef = useRef(null);
  const refreshSessionRef = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const clearAuthState = useCallback(
    (redirect = true) => {
      clearRefreshTimer();
      clearStoredSession();
      delete apiClient.defaults.headers.common.Authorization;
      setUser(null);

      if (redirect) {
        navigate('/login');
      }
    },
    [clearRefreshTimer, navigate]
  );

  const scheduleTokenRefresh = useCallback(
    (expiresAt) => {
      clearRefreshTimer();

      if (!expiresAt) {
        return;
      }

      const expiryTime = new Date(expiresAt).getTime();
      if (Number.isNaN(expiryTime)) {
        return;
      }

      const refreshInMs = expiryTime - Date.now() - REFRESH_BUFFER_MS;

      if (refreshInMs <= 0) {
        if (refreshSessionRef.current) {
          void refreshSessionRef.current();
        }
        return;
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        if (refreshSessionRef.current) {
          void refreshSessionRef.current();
        }
      }, refreshInMs);
    },
    [clearRefreshTimer]
  );

  const refreshSession = useCallback(async () => {
    const currentSession = getStoredSession();
    if (!currentSession?.token) {
      clearAuthState(true);
      return null;
    }

    try {
      const response = await apiClient.post('/auth/refresh', null, {
        headers: {
          Authorization: `Bearer ${currentSession.token}`,
        },
        skipAuthRefresh: true,
      });

      const tokenData = response.data;
      const accessToken = tokenData.access_token;
      const expiresAt = resolveExpiresAt(tokenData);

      const refreshedSession = {
        token: accessToken,
        user: currentSession.user,
        expiresAt,
        rememberMe: currentSession.rememberMe,
      };

      persistSession(refreshedSession);
      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      setUser(currentSession.user);
      scheduleTokenRefresh(expiresAt);

      return accessToken;
    } catch (error) {
      clearAuthState(true);
      throw error;
    }
  }, [clearAuthState, scheduleTokenRefresh]);

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  useEffect(() => {
    registerAuthHandlers({
      onRefresh: refreshSession,
      onLogout: () => clearAuthState(true),
    });

    return () => {
      registerAuthHandlers({
        onRefresh: null,
        onLogout: null,
      });
    };
  }, [refreshSession, clearAuthState]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const session = getStoredSession();
      if (!session) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      apiClient.defaults.headers.common.Authorization = `Bearer ${session.token}`;
      setUser(session.user);

      try {
        if (isNearExpiry(session.expiresAt, REFRESH_BUFFER_MS)) {
          await refreshSession();
        } else {
          scheduleTokenRefresh(session.expiresAt);
        }
      } catch (error) {
        // refreshSession handles cleanup and redirect.
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, refreshSession, scheduleTokenRefresh]);

  const login = async (username, password, rememberMe = false) => {
    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      return {
        success: false,
        error: 'Username and password are required',
      };
    }

    try {
      const formData = new URLSearchParams();
      formData.append('username', normalizedUsername);
      formData.append('password', password);

      const tokenResponse = await apiClient.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        skipAuthRefresh: true,
      });

      const tokenData = tokenResponse.data;
      const accessToken = tokenData.access_token;
      const expiresAt = resolveExpiresAt(tokenData);

      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      const userResponse = await apiClient.get('/auth/me', {
        skipAuthRefresh: true,
      });
      const userData = userResponse.data;

      persistSession({
        token: accessToken,
        user: userData,
        expiresAt,
        rememberMe,
      });

      setUser(userData);
      scheduleTokenRefresh(expiresAt);
      navigate('/');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const logout = useCallback(() => {
    clearAuthState(true);
  }, [clearAuthState]);

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
