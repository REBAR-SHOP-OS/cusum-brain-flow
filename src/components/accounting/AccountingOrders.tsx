import { useState } from "react";
import { OrderList } from "@/components/orders/OrderList";
import { OrderDetail } from "@/components/orders/OrderDetail";
import { useOrders, type Order } from "@/hooks/useOrders";

export function AccountingOrders() {
  const { orders, isLoading } = useOrders();
  const [selected, setSelected] = useState<Order | null>(null);

  if (selected) {
    return (
      <OrderDetail
        order={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <OrderList
      orders={orders}
      isLoading={isLoading}
      onSelect={setSelected}
      selectedId={selected?.id}
    />
  );
}
