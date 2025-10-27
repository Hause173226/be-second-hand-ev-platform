import express from 'express';
import {
  getContractInfo
} from '../controllers/contractController';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// Lấy thông tin hợp đồng (người mua/bán và xe)
router.get('/:appointmentId', authenticate, getContractInfo);

export default router;
