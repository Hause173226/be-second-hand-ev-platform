import { Schema, model, Types } from "mongoose";

export interface IBid {
    userId: Types.ObjectId;
    price: number;
    createdAt: Date;
}

export interface IAuction {
    listingId: Types.ObjectId;
    startAt: Date;
    endAt: Date;
    status: "pending" | "approved" | "active" | "ended" | "cancelled";
    approvalStatus: "pending" | "approved" | "rejected";
    bids: IBid[];
    startingPrice: number;
    depositAmount: number; // Số tiền cọc yêu cầu để tham gia đấu giá
    minParticipants: number; // Số người tham gia tối thiểu
    maxParticipants: number; // Số người tham gia tối đa
    winnerId?: Types.ObjectId;
    winningBid?: IBid;
    approvedBy?: Types.ObjectId; // Staff đã duyệt
    approvedAt?: Date;
    rejectionReason?: string;
    cancellationReason?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const bidSchema = new Schema<IBid>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    price: { type: Number, required: true },
    createdAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const auctionSchema = new Schema<IAuction>({
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["pending", "approved", "active", "ended", "cancelled"], default: "pending" },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    bids: { type: [bidSchema], default: [] },
    startingPrice: { type: Number, required: true },
    depositAmount: { type: Number, required: true, default: 0 }, // Tiền cọc yêu cầu
    minParticipants: { type: Number, default: 1 }, // Tối thiểu 1 người
    maxParticipants: { type: Number, default: 100 }, // Tối đa 100 người
    winnerId: { type: Schema.Types.ObjectId, ref: "User" },
    winningBid: { type: bidSchema },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    cancellationReason: { type: String },
}, { timestamps: true });

auctionSchema.index({ status: 1, endAt: -1 });

export default model<IAuction>("Auction", auctionSchema);
