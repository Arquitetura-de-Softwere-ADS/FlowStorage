// Microserviço: Pedidos de Reposição
import { readStore, writeStore, uid } from "./storage";
import { inventoryService } from "./inventory.service";

export type OrderStatus = "pending" | "received" | "cancelled";

export interface RestockOrder {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  supplier: string;
  status: OrderStatus;
  createdAt: string;
}

const KEY = "svc.orders.restock";

export const ordersService = {
  list(): RestockOrder[] {
    return readStore<RestockOrder[]>(KEY, []);
  },
  create(data: { productId: string; quantity: number; supplier: string }): RestockOrder {
    const product = inventoryService.get(data.productId);
    if (!product) throw new Error("Produto não encontrado");
    const order: RestockOrder = {
      id: uid(),
      productId: data.productId,
      productName: product.name,
      quantity: data.quantity,
      supplier: data.supplier,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const items = this.list();
    items.unshift(order);
    writeStore(KEY, items);
    return order;
  },
  setStatus(id: string, status: OrderStatus) {
    const items = this.list();
    const idx = items.findIndex((o) => o.id === id);
    if (idx === -1) return;
    const prev = items[idx].status;
    items[idx].status = status;
    writeStore(KEY, items);
    // Se recebido, atualiza estoque
    if (status === "received" && prev !== "received") {
      inventoryService.adjustStock(items[idx].productId, items[idx].quantity);
    }
  },
};
