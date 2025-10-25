import mongoose, { Schema } from "mongoose";
import { ISearchHistory } from "../interfaces/ISearchHistory";

const searchHistorySchema = new Schema<ISearchHistory>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null
        },
        searchQuery: {
            type: String,
            required: true,
            trim: true
        },
        searchType: {
            type: String,
            enum: ["listing", "user", "general"],
            default: "listing"
        },
        filters: {
            make: { type: String },
            model: { type: String },
            year: { type: Number },
            batteryCapacityKWh: { type: Number },
            mileageKm: { type: Number },
            minPrice: { type: Number },
            maxPrice: { type: Number },
            city: { type: String },
            district: { type: String },
            condition: { type: String },
            sortBy: { type: String }
        },
        resultsCount: {
            type: Number,
            required: true,
            min: 0
        },
        searchDate: {
            type: Date,
            default: Date.now
        },
        isSuccessful: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

// Index để tối ưu hóa query
searchHistorySchema.index({ userId: 1, searchDate: -1 });
searchHistorySchema.index({ searchQuery: 1, searchType: 1 });
searchHistorySchema.index({ searchDate: -1 });

export const SearchHistory = mongoose.model<ISearchHistory>("SearchHistory", searchHistorySchema);
