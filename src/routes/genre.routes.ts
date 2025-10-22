import { Router } from 'express';
import * as genreController from '../controllers/genre.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// CRUD (DILINDUNGI HANYA OLEH OTENTIKASI)
router.post('/', authenticateToken, genreController.createGenre);
router.patch('/:genre_id', authenticateToken, genreController.updateGenre);
router.delete('/:genre_id', authenticateToken, genreController.deleteGenre);

// PUBLIC
router.get('/', genreController.getAllGenre);
router.get('/:genre_id', genreController.getGenreDetail);

export default router;