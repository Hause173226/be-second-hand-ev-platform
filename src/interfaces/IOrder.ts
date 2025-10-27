export interface IUpdateDeliveryStatusRequest {
  delivery_status: "IN_DELIVERY" | "INSPECTING" | "DELIVERED";
  notes?: string;
}

export interface IUpdateDeliveryStatusResponse {
  message: string;
  order: {
    _id: string;
    status: string;
    delivery_status: string;
    updated_at: Date;
  };
}

export interface IBuyerConfirmRequest {
  is_correct: boolean; // true: đúng mô tả, false: có vấn đề
  rating?: number; // 1-5 sao (optional)
  comment?: string; // Nhận xét (optional)
  issues?: string[]; // Danh sách vấn đề nếu is_correct = false
}

export interface IBuyerConfirmResponse {
  message: string;
  order: {
    _id: string;
    status: string;
    delivery_status: string;
    updated_at: Date;
  };
  escrow_released?: boolean;
  amount_released?: number;
}
