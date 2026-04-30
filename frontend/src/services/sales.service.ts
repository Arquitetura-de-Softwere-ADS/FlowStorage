const API_URL = "http://localhost:8002/sales"; // ajuste porta do seu sales-service

export interface SaleItem {
  product_id: number;
  quantity: number;
  price: number;
}

export interface SaleItemCreate {
  product_id: number;
  quantity: number;
}

export interface Sale {
  id: number;
  total: number;
  created_at: string;
  items: SaleItem[];
}

export const salesService = {
  async list(): Promise<Sale[]> {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Erro ao buscar vendas");
    return res.json();
  },

  async create(items: SaleItemCreate[]): Promise<Sale> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Erro ao criar venda");
    }

    return res.json();
  },
};
