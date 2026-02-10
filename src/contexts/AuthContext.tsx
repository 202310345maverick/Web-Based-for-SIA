'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type AppRole = 'admin' | 'instructor';

interface AppUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, unknown>;
}

interface AppSession {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: AppUser;
}

interface AuthContextType {
  user: AppUser | null;
  session: AppSession | null;
  loading: boolean;
  userRole: AppRole | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  const signUp = async (email: string, _password: string, fullName: string) => {
    const newUser: AppUser = {
      id: `user_${Date.now()}`,
      email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: { full_name: fullName },
    };

    const newSession: AppSession = {
      access_token: `token_${Date.now()}`,
      expires_in: 3600,
      token_type: 'bearer',
      user: newUser,
    };

    setUser(newUser);
    setSession(newSession);
    setUserRole('admin');
    
    return { error: null };
  };

  const signIn = async (email: string, _password: string) => {
    const newUser: AppUser = {
      id: `user_${Date.now()}`,
      email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: { full_name: 'User' },
    };

    const newSession: AppSession = {
      access_token: `token_${Date.now()}`,
      expires_in: 3600,
      token_type: 'bearer',
      user: newUser,
    };

    setUser(newUser);
    setSession(newSession);
    setUserRole('admin');
    
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
