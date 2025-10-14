// src/routes/profileRoutes.ts
import express from "express";
import { profileService } from "../services/profileService";
import { authenticateJWT } from "../middlewares/authenticate";

const profileRoutes = express.Router();

/**
 * @swagger
 * /api/profiles/me:
 *   get:
 *     summary: Lấy thông tin profile của user hiện tại
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin profile được trả về thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 bio:
 *                   type: string
 *                 location:
 *                   type: string
 *                 website:
 *                   type: string
 *                 socialMedia:
 *                   type: object
 *                   properties:
 *                     facebook:
 *                       type: string
 *                     instagram:
 *                       type: string
 *                     twitter:
 *                       type: string
 *                     linkedin:
 *                       type: string
 *                 preferences:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: boolean
 *                     emailUpdates:
 *                       type: boolean
 *                     smsUpdates:
 *                       type: boolean
 *                 vehiclePreferences:
 *                   type: object
 *                   properties:
 *                     brands:
 *                       type: array
 *                       items:
 *                         type: string
 *                     priceRange:
 *                       type: object
 *                       properties:
 *                         min:
 *                           type: number
 *                         max:
 *                           type: number
 *                     fuelTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                 isComplete:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Token không hợp lệ
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/me:
 *   put:
 *     summary: Cập nhật thông tin profile của user hiện tại
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               location:
 *                 type: string
 *               website:
 *                 type: string
 *               socialMedia:
 *                 type: object
 *                 properties:
 *                   facebook:
 *                     type: string
 *                   instagram:
 *                     type: string
 *                   twitter:
 *                     type: string
 *                   linkedin:
 *                     type: string
 *               preferences:
 *                 type: object
 *                 properties:
 *                   notifications:
 *                     type: boolean
 *                   emailUpdates:
 *                     type: boolean
 *                   smsUpdates:
 *                     type: boolean
 *               vehiclePreferences:
 *                 type: object
 *                 properties:
 *                   brands:
 *                     type: array
 *                     items:
 *                       type: string
 *                   priceRange:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: number
 *                       max:
 *                         type: number
 *                   fuelTypes:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Profile đã được cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Unauthorized - Token không hợp lệ
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/profiles/me/completeness:
 *   get:
 *     summary: Kiểm tra độ hoàn thiện của profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin độ hoàn thiện profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isComplete:
 *                   type: boolean
 *                 percentage:
 *                   type: number
 *                 completedFields:
 *                   type: number
 *                 totalFields:
 *                   type: number
 *                 missingFields:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized - Token không hợp lệ
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Internal server error
 */

// Get current user's profile
profileRoutes.get("/me", authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const profile = await profileService.getProfileByUserId(userId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update current user's profile
profileRoutes.put("/me", authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;
    const profile = await profileService.updateProfile(userId, updateData);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Check profile completeness
profileRoutes.get(
  "/me/completeness",
  authenticateJWT,
  async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const completeness = await profileService.checkCompleteness(userId);
      res.json(completeness);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default profileRoutes;
