const API_URL = "http://localhost:8003"; // porta do seu inventory-service

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
}

export const inventoryService = {
  async list(): Promise<Product[]> {
    const res = await fetch(`${API_URL}/produtos/`);
    if (!res.ok) throw new Error("Erro ao buscar produtos");
    return res.json();
  },

  async get(id: number): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/${id}`);
    if (!res.ok) throw new Error("Produto não encontrado");
    return res.json();
  },

  async create(data: Omit<Product, "id">): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error("Erro ao criar produto");
    return res.json();
  },

  async update(id: number, patch: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    if (!res.ok) throw new Error("Erro ao atualizar produto");
    return res.json();
  },

  async remove(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/produtos/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Erro ao remover produto");
  },
};
