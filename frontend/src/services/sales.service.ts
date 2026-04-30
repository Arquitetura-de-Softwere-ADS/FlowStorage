import { readStore, writeStore, uid } from "./storage";
import { inventoryService } from "./inventory.service";

export interface Sale {
  id: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

const KEY = "sales.records";

export const salesService = {
  list(): Sale[] {
    return readStore<Sale[]>(KEY, []);
  },

  async create(productId: number, quantity: number): Promise<Sale> {
    const product = await inventoryService.get(productId);

    if (!product) throw new Error("Produto não encontrado");
    if (product.stock < quantity) throw new Error("Estoque insuficiente");

    // 🔥 AQUI ESTÁ A CORREÇÃO
    await inventoryService.update(productId, {
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      stock: product.stock - quantity,
      minStock: product.minStock,
    });

    const sale: Sale = {
      id: uid(),
      productId,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      total: product.price * quantity,
      createdAt: new Date().toISOString(),
    };

    const items = this.list();
    items.unshift(sale);

    writeStore(KEY, items);

    return sale;
  },
};
