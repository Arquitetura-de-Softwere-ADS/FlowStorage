import { useEffect, useState, useCallback } from "react";
import { authService, type User } from "@/services/auth.service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(authService.current());
    setReady(true);
  }, []);

  const login = useCallback((email: string, password: string) => {
    const u = authService.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback((name: string, email: string, password: string) => {
    const u = authService.register(name, email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return { user, ready, login, register, logout };
}
