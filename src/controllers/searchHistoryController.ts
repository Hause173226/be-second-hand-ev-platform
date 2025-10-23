// src/controllers/searchHistoryController.ts
import { RequestHandler } from "express";
import { SearchHistory } from "../models/SearchHistory";

/**
 * Lưu lịch sử tìm kiếm của user
 */
export const saveSearchHistory: RequestHandler = async (req, res, next) => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { searchQuery, searchType = "listing", filters, resultsCount } = req.body;

        if (!searchQuery || !searchQuery.trim()) {
            res.status(400).json({ message: "searchQuery là bắt buộc" });
            return;
        }

        const searchHistory = await SearchHistory.create({
            userId,
            searchQuery: searchQuery.trim(),
            searchType,
            filters,
            resultsCount: resultsCount || 0,
            searchDate: new Date(),
            isSuccessful: true
        });

        res.status(201).json({
            success: true,
            message: "Search history saved successfully",
            data: searchHistory
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Lấy lịch sử tìm kiếm của user
 */
export const getUserSearchHistory: RequestHandler = async (req, res, next) => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { limit = "10", searchType } = req.query;
        const limitNum = parseInt(limit as string) || 10;

        const filter: any = { userId };
        if (searchType) {
            filter.searchType = searchType;
        }

        const searchHistory = await SearchHistory.find(filter)
            .sort({ searchDate: -1 })
            .limit(limitNum)
            .lean();

        res.json({
            success: true,
            data: searchHistory,
            count: searchHistory.length
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Xóa lịch sử tìm kiếm của user
 */
export const clearUserSearchHistory: RequestHandler = async (req, res, next) => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const result = await SearchHistory.deleteMany({ userId });

        res.json({
            success: true,
            message: `Cleared ${result.deletedCount} search history records`,
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Xóa một lịch sử tìm kiếm cụ thể
 */
export const deleteSearchHistoryItem: RequestHandler = async (req, res, next) => {
    try {
        const userId = (req as any).user?._id;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const searchHistory = await SearchHistory.findOneAndDelete({
            _id: id,
            userId
        });

        if (!searchHistory) {
            res.status(404).json({ message: "Search history not found" });
            return;
        }

        res.json({
            success: true,
            message: "Search history deleted successfully",
            data: searchHistory
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Lấy lịch sử tìm kiếm phổ biến (tất cả user)
 */
export const getPopularSearchHistory: RequestHandler = async (req, res, next) => {
    try {
        const { limit = "10", searchType = "listing" } = req.query;
        const limitNum = parseInt(limit as string) || 10;

        // Aggregate để lấy các từ khóa tìm kiếm phổ biến
        const popularSearches = await SearchHistory.aggregate([
            {
                $match: {
                    searchType: searchType,
                    searchQuery: { $ne: "" } // Loại bỏ các query rỗng
                }
            },
            {
                $group: {
                    _id: "$searchQuery",
                    count: { $sum: 1 },
                    lastSearched: { $max: "$searchDate" },
                    avgResultsCount: { $avg: "$resultsCount" }
                }
            },
            {
                $sort: { count: -1, lastSearched: -1 }
            },
            {
                $limit: limitNum
            },
            {
                $project: {
                    query: "$_id",
                    count: 1,
                    lastSearched: 1,
                    avgResultsCount: { $round: ["$avgResultsCount", 1] },
                    category: {
                        $cond: {
                            if: { $gte: ["$count", 10] },
                            then: "popular",
                            else: {
                                $cond: {
                                    if: { $gte: ["$count", 5] },
                                    then: "trending",
                                    else: "recent"
                                }
                            }
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: popularSearches,
            count: popularSearches.length
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Lấy gợi ý tìm kiếm dựa trên từ khóa
 */
export const getSearchSuggestions: RequestHandler = async (req, res, next) => {
    try {
        const { keyword, limit = "10" } = req.query;
        const limitNum = parseInt(limit as string) || 10;

        if (!keyword || !keyword.toString().trim()) {
            res.status(400).json({ message: "keyword là bắt buộc" });
            return;
        }

        const keywordStr = keyword.toString().trim();

        // Tìm các từ khóa tương tự
        const suggestions = await SearchHistory.aggregate([
            {
                $match: {
                    searchQuery: { $regex: keywordStr, $options: "i" },
                    searchType: "listing"
                }
            },
            {
                $group: {
                    _id: "$searchQuery",
                    count: { $sum: 1 },
                    lastSearched: { $max: "$searchDate" }
                }
            },
            {
                $sort: { count: -1, lastSearched: -1 }
            },
            {
                $limit: limitNum
            },
            {
                $project: {
                    query: "$_id",
                    count: 1,
                    lastSearched: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: suggestions,
            count: suggestions.length
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Lấy thống kê tìm kiếm
 */
export const getSearchStats: RequestHandler = async (req, res, next) => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const stats = await SearchHistory.aggregate([
            {
                $match: { userId }
            },
            {
                $group: {
                    _id: null,
                    totalSearches: { $sum: 1 },
                    successfulSearches: {
                        $sum: { $cond: ["$isSuccessful", 1, 0] }
                    },
                    averageResults: { $avg: "$resultsCount" },
                    uniqueQueryCount: { $addToSet: "$searchQuery" }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSearches: 1,
                    successfulSearches: 1,
                    successRate: {
                        $round: [
                            { $multiply: [{ $divide: ["$successfulSearches", "$totalSearches"] }, 100] },
                            1
                        ]
                    },
                    averageResults: { $round: ["$averageResults", 1] },
                    uniqueQueryCount: { $size: "$uniqueQueryCount" }
                }
            }
        ]);

        const result = stats[0] || {
            totalSearches: 0,
            successfulSearches: 0,
            successRate: 0,
            averageResults: 0,
            uniqueQueryCount: 0
        };

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        next(err);
    }
};
