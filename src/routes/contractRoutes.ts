import express from 'express';
import {
  getContractInfo,
  uploadContractPhotos,
  completeTransaction,
  getStaffContracts
} from '../controllers/contractController';
import { authenticate } from '../middlewares/authenticate';
import { upload } from '../utils/upload';

const router = express.Router();

/**
 * @swagger
 * /api/contracts/{appointmentId}:
 *   get:
 *     summary: Lấy thông tin hợp đồng
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin hợp đồng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Contract"
 */
router.get('/:appointmentId', authenticate, getContractInfo);

/**
 * @swagger
 * /api/contracts/{appointmentId}/upload-photos:
 *   post:
 *     summary: Staff upload ảnh hợp đồng đã ký
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Upload ảnh thành công
 */
router.post('/:appointmentId/upload-photos', 
  authenticate, 
  upload.array('photos', 10), // Tối đa 10 ảnh
  uploadContractPhotos
);

/**
 * @swagger
 * /api/contracts/{appointmentId}/complete:
 *   post:
 *     summary: Staff xác nhận giao dịch hoàn thành
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hoàn thành giao dịch thành công
 */
router.post('/:appointmentId/complete', authenticate, completeTransaction);

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Lấy danh sách contract cho staff
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách contract
 */
router.get('/', authenticate, getStaffContracts);

export default router;
