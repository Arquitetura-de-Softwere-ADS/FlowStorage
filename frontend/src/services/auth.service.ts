// Microserviço: Autenticação
import { readStore, writeStore, uid } from "./storage";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface StoredUser extends User {
  password: string;
}

const USERS_KEY = "svc.auth.users";
const SESSION_KEY = "svc.auth.session";

function getUsers(): StoredUser[] {
  return readStore<StoredUser[]>(USERS_KEY, []);
}

export const authService = {
  register(name: string, email: string, password: string): User {
    const users = getUsers();
    if (users.some((u) => u.email === email)) {
      throw new Error("E-mail já cadastrado");
    }
    const user: StoredUser = { id: uid(), name, email, password };
    users.push(user);
    writeStore(USERS_KEY, users);
    const { password: _, ...safe } = user;
    writeStore(SESSION_KEY, safe);
    return safe;
  },
  login(email: string, password: string): User {
    const user = getUsers().find((u) => u.email === email && u.password === password);
    if (!user) throw new Error("Credenciais inválidas");
    const { password: _, ...safe } = user;
    writeStore(SESSION_KEY, safe);
    return safe;
  },
  logout() {
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
  },
  current(): User | null {
    return readStore<User | null>(SESSION_KEY, null);
  },
};
