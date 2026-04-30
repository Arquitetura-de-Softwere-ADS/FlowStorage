// Microserviço: Pedidos de Reposição (AGORA COM API REAL)

const API_URL = "http://localhost:8004"; // 🔥 ajuste se necessário

export type OrderStatus = "Pendente" | "Recebido" | "Cancelado";

export interface RestockOrder {
  id: number;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  fornecedor: string;
  status: OrderStatus;
  data: string;
}

export const ordersService = {
  async list(): Promise<RestockOrder[]> {
    const res = await fetch(`${API_URL}/pedidos/`);
    if (!res.ok) throw new Error("Erro ao buscar pedidos");
    return res.json();
  },

  async create(data: { produto_id: number; quantidade: number; fornecedor: string }) {
    const res = await fetch(`${API_URL}/pedidos/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Erro ao criar pedido");
    }

    return res.json();
  },

  async receber(id: number) {
    const res = await fetch(`${API_URL}/pedidos/${id}/receber`, {
      method: "POST",
    });

    if (!res.ok) throw new Error("Erro ao receber pedido");
  },

  async cancelar(id: number) {
    const res = await fetch(`${API_URL}/pedidos/${id}/cancelar`, {
      method: "POST",
    });

    if (!res.ok) throw new Error("Erro ao cancelar pedido");
  },
};
