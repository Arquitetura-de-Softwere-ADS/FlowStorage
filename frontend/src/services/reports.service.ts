// Microserviço: Relatórios
import { inventoryService } from "./inventory.service";
import { salesService } from "./sales.service";
import { ordersService } from "./orders.service";

export const reportsService = {
  inventorySummary() {
    const products = inventoryService.list();
    const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const lowStock = products.filter((p) => p.stock <= p.minStock);
    return {
      totalProducts: products.length,
      totalUnits: products.reduce((s, p) => s + p.stock, 0),
      totalValue,
      lowStock,
    };
  },
  salesSummary() {
    const sales = salesService.list();
    const revenue = sales.reduce((s, x) => s + x.total, 0);
    const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const s of sales) {
      const cur = byProduct.get(s.productId) ?? { name: s.productName, qty: 0, revenue: 0 };
      cur.qty += s.quantity;
      cur.revenue += s.total;
      byProduct.set(s.productId, cur);
    }
    return {
      totalSales: sales.length,
      revenue,
      topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  },
  ordersSummary() {
    const orders = ordersService.list();
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      received: orders.filter((o) => o.status === "received").length,
    };
  },
};
