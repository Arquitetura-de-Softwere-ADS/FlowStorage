// Microserviço: Controle de Inventário
import { readStore, writeStore, uid } from "./storage";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  createdAt: string;
}

const KEY = "svc.inventory.products";

export const inventoryService = {
  list(): Product[] {
    return readStore<Product[]>(KEY, []);
  },
  get(id: string): Product | undefined {
    return this.list().find((p) => p.id === id);
  },
  create(data: Omit<Product, "id" | "createdAt">): Product {
    const items = this.list();
    const product: Product = { ...data, id: uid(), createdAt: new Date().toISOString() };
    items.push(product);
    writeStore(KEY, items);
    return product;
  },
  update(id: string, patch: Partial<Product>): Product | undefined {
    const items = this.list();
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) return;
    items[idx] = { ...items[idx], ...patch };
    writeStore(KEY, items);
    return items[idx];
  },
  remove(id: string) {
    writeStore(KEY, this.list().filter((p) => p.id !== id));
  },
  adjustStock(id: string, delta: number) {
    const p = this.get(id);
    if (!p) throw new Error("Produto não encontrado");
    if (p.stock + delta < 0) throw new Error("Estoque insuficiente");
    return this.update(id, { stock: p.stock + delta });
  },
};
