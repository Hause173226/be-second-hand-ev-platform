import express from 'express';
import {
  createDepositRequest,
  sellerConfirmDeposit,
  getBuyerDepositRequests,
  getSellerDepositRequests,
  cancelDepositRequest
} from '../controllers/depositController';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// Tạo yêu cầu đặt cọc
router.post('/', authenticate, createDepositRequest);

// Người bán xác nhận/ từ chối cọc
router.post('/:depositRequestId/confirm', authenticate, sellerConfirmDeposit);

// Lấy danh sách yêu cầu đặt cọc của người mua
router.get('/buyer', authenticate, getBuyerDepositRequests);

// Lấy danh sách yêu cầu đặt cọc của người bán
router.get('/seller', authenticate, getSellerDepositRequests);

// Hủy yêu cầu đặt cọc (chỉ người mua)
router.delete('/:depositRequestId', authenticate, cancelDepositRequest);

export default router;
