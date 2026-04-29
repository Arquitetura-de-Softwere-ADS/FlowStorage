import { useEffect, useState, useCallback } from "react";
import { authService, type User } from "@/services/auth.service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = authService.current();
    setUser(u);
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authService.login(email, password); // 🔥 await
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const u = await authService.register(name, email, password); // 🔥 await
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return { user, ready, login, register, logout };
}
