import { createContext, useContext, useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

function readStoredUser() {
  const savedUser = localStorage.getItem('user');
  if (!savedUser || savedUser === 'undefined' || savedUser === 'null') {
    return null;
  }

  try {
    const parsedUser = JSON.parse(savedUser);
    return parsedUser && typeof parsedUser === 'object' ? parsedUser : null;
  } catch (_) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const login = (data) => {
    if (!data?.token || !data?.user || typeof data.user !== 'object') {
      throw new Error('Phản hồi đăng nhập không hợp lệ');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const updateUser = (newUser) => {
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) await axiosClient.post('/auth/logout');
    } catch (_) {
      // JWT logout phía frontend vẫn xóa token local.
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
