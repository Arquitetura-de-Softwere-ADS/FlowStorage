const API_URL = "http://localhost:8003";

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
}

// 👉 tipo da API (IMPORTANTE)
interface ProductAPI {
  id: number;
  nome: string;
  sku: string;
  categoria: string;
  preco: number;
  estoque: number;
  minimo: number;
}

export const inventoryService = {
  async list(): Promise<Product[]> {
    const res = await fetch(`${API_URL}/produtos/`);
    if (!res.ok) throw new Error("Erro ao buscar produtos");

    const data: ProductAPI[] = await res.json();

    return data.map((p) => ({
      id: p.id,
      name: p.nome,
      sku: p.sku,
      category: p.categoria,
      price: p.preco,
      stock: p.estoque,
      minStock: p.minimo,
    }));
  },

  async get(id: number): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/${id}`);
    if (!res.ok) throw new Error("Produto não encontrado");

    const p: ProductAPI = await res.json();

    return {
      id: p.id,
      name: p.nome,
      sku: p.sku,
      category: p.categoria,
      price: p.preco,
      stock: p.estoque,
      minStock: p.minimo,
    };
  },

  async create(data: Omit<Product, "id">): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome: data.name,
        sku: data.sku,
        categoria: data.category,
        preco: data.price,
        estoque: data.stock,
        minimo: data.minStock,
      }),
    });

    if (!res.ok) throw new Error("Erro ao criar produto");

    const p: ProductAPI = await res.json();

    return {
      id: p.id,
      name: p.nome,
      sku: p.sku,
      category: p.categoria,
      price: p.preco,
      stock: p.estoque,
      minStock: p.minimo,
    };
  },

  async update(id: number, patch: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome: patch.name,
        sku: patch.sku,
        categoria: patch.category,
        preco: patch.price,
        estoque: patch.stock,
        minimo: patch.minStock,
      }),
    });

    if (!res.ok) throw new Error("Erro ao atualizar produto");

    const p: ProductAPI = await res.json();

    return {
      id: p.id,
      name: p.nome,
      sku: p.sku,
      category: p.categoria,
      price: p.preco,
      stock: p.estoque,
      minStock: p.minimo,
    };
  },

  async remove(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/produtos/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Erro ao remover produto");
  },
};
