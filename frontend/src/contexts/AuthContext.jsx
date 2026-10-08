import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// The backend checks the signature, only the payload is read here.
const decodeJWT = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json);
  } catch (error) {
    console.error(error);
    return null;
  }
};

const userFromToken = (token) => {
  const decoded = decodeJWT(token);
  if (!decoded) return null;
  return {
    id: decoded.user_id,
    name: decoded.sub,
    role: decoded.role,
    fullname: decoded.fullname,
    account_id: decoded.account_id,
    login_id: decoded.login_id,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) setUser(userFromToken(token));
    setLoading(false);
  }, []);

  const login = (token) => {
    localStorage.setItem('auth_token', token);
    setUser(userFromToken(token));
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
