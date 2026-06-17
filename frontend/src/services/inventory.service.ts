const API_URL = "http://localhost:8003";

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  supplier: string | null;
  autoReorderEnabled: boolean;
}

interface ProductAPI {
  id: number;
  nome: string;
  sku: string;
  categoria: string;
  preco: number;
  estoque: number;
  minimo: number;
  fornecedor: string | null;
  auto_reorder_enabled: boolean;
}

interface AutoReorderAPI {
  product_id: number;
  auto_reorder_enabled: boolean;
}

async function getErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

function mapProduct(p: ProductAPI): Product {
  return {
    id: p.id,
    name: p.nome,
    sku: p.sku,
    category: p.categoria,
    price: p.preco,
    stock: p.estoque,
    minStock: p.minimo,
    supplier: p.fornecedor ?? null,
    autoReorderEnabled: Boolean(p.auto_reorder_enabled),
  };
}

export const inventoryService = {
  async list(): Promise<Product[]> {
    const res = await fetch(`${API_URL}/produtos/`);
    if (!res.ok) throw new Error("Erro ao buscar produtos");

    const data: ProductAPI[] = await res.json();

    return data.map(mapProduct);
  },

  async get(id: number): Promise<Product> {
    const res = await fetch(`${API_URL}/produtos/${id}`);
    if (!res.ok) throw new Error("Produto não encontrado");

    const p: ProductAPI = await res.json();

    return mapProduct(p);
  },

  async create(
    data: Omit<Product, "id" | "autoReorderEnabled"> & { autoReorderEnabled?: boolean },
  ): Promise<Product> {
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
        fornecedor: data.supplier || null,
      }),
    });

    if (!res.ok) throw new Error(await getErrorMessage(res, "Erro ao criar produto"));

    const p: ProductAPI = await res.json();

    return mapProduct(p);
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
        fornecedor: patch.supplier || null,
      }),
    });

    if (!res.ok) throw new Error(await getErrorMessage(res, "Erro ao atualizar produto"));

    const p: ProductAPI = await res.json();

    return mapProduct(p);
  },

  async remove(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/produtos/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Erro ao remover produto");
  },

  async setAutoReorder(id: number, enabled: boolean): Promise<AutoReorderAPI> {
    const res = await fetch(`${API_URL}/produtos/${id}/auto-reorder`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });

    if (!res.ok) {
      throw new Error(
        await getErrorMessage(res, "Erro ao atualizar reposição automática"),
      );
    }

    return res.json();
  },
};
