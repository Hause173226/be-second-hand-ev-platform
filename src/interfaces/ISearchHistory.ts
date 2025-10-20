import { Types } from "mongoose";

export interface ISearchHistory {
    userId: Types.ObjectId | null;
    searchQuery: string;
    searchType: "listing" | "user" | "general";
    filters?: {
        make?: string;
        model?: string;
        year?: number;
        batteryCapacityKWh?: number;
        mileageKm?: number;
        minPrice?: number;
        maxPrice?: number;
        city?: string;
        district?: string;
        condition?: string;
        sortBy?: string;
    };
    resultsCount: number;
    searchDate: Date;
    isSuccessful: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
