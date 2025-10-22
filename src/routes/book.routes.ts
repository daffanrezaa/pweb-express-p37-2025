import { Router } from 'express';
import * as bookController from '../controllers/book.controller';
// HANYA import authenticateToken
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// CRUD (DILINDUNGI HANYA OLEH OTENTIKASI)
router.post('/', authenticateToken, bookController.createBook);
router.patch('/:book_id', authenticateToken, bookController.updateBook);
router.delete('/:book_id', authenticateToken, bookController.deleteBook);

// PUBLIC
router.get('/', bookController.getAllBook);
router.get('/genre/:genre_id', bookController.getBooksByGenre);
router.get('/:book_id', bookController.getBookDetail);

export default router;