export interface User {
  id: number;
  name: string;
  email: string;
}

const API_URL = "http://localhost:8001/auth";

export const authService = {
  async register(name: string, email: string, password: string): Promise<User> {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail);
    }

    return res.json();
  },

  async login(email: string, password: string): Promise<User> {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail);
    }

    const data = await res.json();

    // 🔥 salva token
    localStorage.setItem("token", data.access_token);

    // 🔥 busca usuário
    const meRes = await fetch(`${API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    const user = await meRes.json();

    localStorage.setItem("user", JSON.stringify(user));

    return user;
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  current(): User | null {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },
};
