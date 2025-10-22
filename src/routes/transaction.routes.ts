import express from 'express';
import {
  createTransaction,
  getAllTransactions,
  getTransactionDetail,
  getTransactionStatistics,
} from '../controllers/transaction.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/', authenticateToken, createTransaction);
router.get('/', authenticateToken, getAllTransactions);
router.get('/statistics', authenticateToken, getTransactionStatistics); 
router.get('/:id', authenticateToken, getTransactionDetail);

export default router;