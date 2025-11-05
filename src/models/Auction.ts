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
    status: "active" | "ended" | "cancelled";
    bids: IBid[];
    startingPrice: number;
    depositAmount: number; // Số tiền cọc yêu cầu để tham gia đấu giá
    winnerId?: Types.ObjectId;
    winningBid?: IBid;
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
    status: { type: String, enum: ["active", "ended", "cancelled"], default: "active" },
    bids: { type: [bidSchema], default: [] },
    startingPrice: { type: Number, required: true },
    depositAmount: { type: Number, required: true, default: 0 }, // Tiền cọc yêu cầu
    winnerId: { type: Schema.Types.ObjectId, ref: "User" },
    winningBid: { type: bidSchema },
}, { timestamps: true });

auctionSchema.index({ status: 1, endAt: -1 });

export default model<IAuction>("Auction", auctionSchema);
