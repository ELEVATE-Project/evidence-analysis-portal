const STORAGE_KEYS = {
  token: 'token',
  user: 'user',
  expiresAt: 'token_expires_at',
  rememberMe: 'remember_me',
};

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const readSessionFromStorage = (storage, rememberMe) => {
  const token = storage.getItem(STORAGE_KEYS.token);
  const userRaw = storage.getItem(STORAGE_KEYS.user);
  const expiresAt = storage.getItem(STORAGE_KEYS.expiresAt);

  if (!token || !userRaw || !expiresAt) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userRaw),
      expiresAt,
      rememberMe,
    };
  } catch (error) {
    return null;
  }
};

export const getStoredSession = () => {
  const localSession = readSessionFromStorage(localStorage, true);
  if (localSession) {
    return localSession;
  }

  return readSessionFromStorage(sessionStorage, false);
};

export const getAccessToken = () => {
  const session = getStoredSession();
  return session?.token || null;
};

export const clearStoredSession = () => {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(STORAGE_KEYS.token);
    storage.removeItem(STORAGE_KEYS.user);
    storage.removeItem(STORAGE_KEYS.expiresAt);
    storage.removeItem(STORAGE_KEYS.rememberMe);
  });
};

export const persistSession = ({ token, user, expiresAt, rememberMe }) => {
  clearStoredSession();
  const targetStorage = rememberMe ? localStorage : sessionStorage;

  targetStorage.setItem(STORAGE_KEYS.token, token);
  targetStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  targetStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt);
  targetStorage.setItem(STORAGE_KEYS.rememberMe, String(rememberMe));
};

export const decodeJwtExpiry = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (!decodedPayload.exp) {
      return null;
    }

    return new Date(decodedPayload.exp * 1000).toISOString();
  } catch (error) {
    return null;
  }
};

export const resolveExpiresAt = (tokenData) => {
  if (tokenData?.expires_at) {
    return tokenData.expires_at;
  }

  if (tokenData?.access_token) {
    const jwtExpiry = decodeJwtExpiry(tokenData.access_token);
    if (jwtExpiry) {
      return jwtExpiry;
    }
  }

  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
};

export const isNearExpiry = (expiresAt, bufferMs = REFRESH_BUFFER_MS) => {
  if (!expiresAt) {
    return true;
  }

  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) {
    return true;
  }

  return expiryTime - Date.now() <= bufferMs;
};

export { REFRESH_BUFFER_MS };
