// Microserviço: Registro de Vendas
import { readStore, writeStore, uid } from "./storage";
import { inventoryService } from "./inventory.service";

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

const KEY = "svc.sales.records";

export const salesService = {
  list(): Sale[] {
    return readStore<Sale[]>(KEY, []);
  },
  create(productId: string, quantity: number): Sale {
    const product = inventoryService.get(productId);
    if (!product) throw new Error("Produto não encontrado");
    if (product.stock < quantity) throw new Error("Estoque insuficiente");
    inventoryService.adjustStock(productId, -quantity);
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
