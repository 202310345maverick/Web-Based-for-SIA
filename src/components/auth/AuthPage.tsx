'use client';

import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  const toggleMode = () => setIsLogin(!isLogin);

  if (isLogin) {
    return <LoginForm onToggleMode={toggleMode} />;
  }

  return <SignUpForm onToggleMode={toggleMode} />;
}
