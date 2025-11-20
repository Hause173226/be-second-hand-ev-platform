export const CONTRACT_TYPES = ["DEPOSIT", "FULL_PAYMENT"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TIMELINE_STEPS = [
  "SIGN_CONTRACT",
  "NOTARIZATION",
  "SUBMIT_REGISTRATION",
  "WAITING_FOR_NEW_PAPERS",
  "HANDOVER_PAPERS_AND_CAR",
] as const;
export type ContractTimelineStepId = (typeof CONTRACT_TIMELINE_STEPS)[number];

export const CONTRACT_TIMELINE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
] as const;
export type ContractTimelineStatus =
  (typeof CONTRACT_TIMELINE_STATUSES)[number];

export type ContractTimelineAttachment = {
  url: string;
  publicId: string;
  description?: string;
  uploadedAt: Date;
  uploadedBy: string;
};

export type ContractTimelineStep = {
  step: ContractTimelineStepId;
  status: ContractTimelineStatus;
  note?: string;
  dueDate?: Date;
  updatedBy?: string;
  updatedAt?: Date;
  attachments: ContractTimelineAttachment[];
};

export function buildDefaultTimeline(
  contractType: ContractType = "FULL_PAYMENT"
) {
  // ✅ Tất cả các bước ban đầu đều là PENDING để hiển thị đẹp hơn
  // BLOCKED sẽ được set khi thực sự cần (ví dụ: chưa thanh toán đủ 100% cho DEPOSIT)
  return CONTRACT_TIMELINE_STEPS.map<ContractTimelineStep>((step, index) => {
    return {
      step,
      status: "PENDING" as ContractTimelineStatus,
      note: undefined,
      dueDate: undefined,
      updatedAt: undefined,
      updatedBy: undefined,
      attachments: [],
    };
  });
}

export function isValidTimelineStep(
  step: string
): step is ContractTimelineStepId {
  return CONTRACT_TIMELINE_STEPS.includes(step as ContractTimelineStepId);
}

export function isValidTimelineStatus(
  status: string
): status is ContractTimelineStatus {
  return CONTRACT_TIMELINE_STATUSES.includes(status as ContractTimelineStatus);
}
