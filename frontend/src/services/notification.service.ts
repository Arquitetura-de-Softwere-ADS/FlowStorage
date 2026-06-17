const API_URL = "http://localhost:8005";

export const NOTIFICATION_USER_ID = 1;

export interface Subscription {
  id: number;
  userId: number;
  productId: number;
  createdAt: string;
}

export interface StockNotification {
  id: number;
  userId: number;
  productId: number;
  title: string;
  message: string;
  eventType: string;
  read: boolean;
  createdAt: string;
}

interface SubscriptionAPI {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
}

interface StockNotificationAPI {
  id: number;
  user_id: number;
  product_id: number;
  title: string;
  message: string;
  event_type: string;
  read: boolean;
  created_at: string;
}

async function getErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

function mapSubscription(data: SubscriptionAPI): Subscription {
  return {
    id: data.id,
    userId: data.user_id,
    productId: data.product_id,
    createdAt: data.created_at,
  };
}

function mapNotification(data: StockNotificationAPI): StockNotification {
  return {
    id: data.id,
    userId: data.user_id,
    productId: data.product_id,
    title: data.title,
    message: data.message,
    eventType: data.event_type,
    read: data.read,
    createdAt: data.created_at,
  };
}

export const notificationService = {
  async listSubscriptions(userId = NOTIFICATION_USER_ID): Promise<Subscription[]> {
    const res = await fetch(`${API_URL}/subscriptions/${userId}`);
    if (!res.ok) {
      throw new Error(await getErrorMessage(res, "Erro ao buscar inscrições"));
    }

    const data: SubscriptionAPI[] = await res.json();
    return data.map(mapSubscription);
  },

  async createSubscription(
    productId: number,
    userId = NOTIFICATION_USER_ID,
  ): Promise<Subscription> {
    const res = await fetch(`${API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        product_id: productId,
      }),
    });

    if (!res.ok) {
      throw new Error(await getErrorMessage(res, "Erro ao ativar notificações"));
    }

    const data: SubscriptionAPI = await res.json();
    return mapSubscription(data);
  },

  async deleteSubscription(subscriptionId: number): Promise<void> {
    const res = await fetch(`${API_URL}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(await getErrorMessage(res, "Erro ao desativar notificações"));
    }
  },

  async listNotifications(userId = NOTIFICATION_USER_ID): Promise<StockNotification[]> {
    const res = await fetch(`${API_URL}/notifications/${userId}`);
    if (!res.ok) {
      throw new Error(await getErrorMessage(res, "Erro ao buscar notificações"));
    }

    const data: StockNotificationAPI[] = await res.json();
    return data.map(mapNotification);
  },

  async markNotificationAsRead(notificationId: number): Promise<StockNotification> {
    const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
      method: "PATCH",
    });

    if (!res.ok) {
      throw new Error(await getErrorMessage(res, "Erro ao marcar notificação como lida"));
    }

    const data: StockNotificationAPI = await res.json();
    return mapNotification(data);
  },
};
