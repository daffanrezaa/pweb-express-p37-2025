// src/controllers/book.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// ----------------------------------------------------------------------
// CRUD Operations
// ----------------------------------------------------------------------

// POST /books
export const createBook = async (req: Request, res: Response) => {
    try {
        const { title, writer, publisher, publication_year, description, price, stock_quantity, genre_id } = req.body;

        if (!title || !writer || !publisher || !publication_year || !price || !stock_quantity || !genre_id) {
            return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
        }

        const newBook = await prisma.book.create({
            data: {
                title,
                writer,
                publisher,
                publicationYear: publication_year,
                description,
                price: Number(price),
                stockQuantity: Number(stock_quantity),
                genreId: genre_id,
            },
        });

        res.status(201).json({ success: true, message: 'Book created successfully', data: newBook });
    } catch (error: any) {
        // Handle unique constraint error (e.g., duplicate title)
        if (error.code === 'P2002') {
             return res.status(400).json({ success: false, message: 'Title already exists.' });
        }
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// GET /books
export const getAllBook = async (req: Request, res: Response) => {
    try {
        const books = await prisma.book.findMany({
            where: { deletedAt: null },
            include: {
                genre: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, message: 'Books fetched successfully', data: books });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// GET /books/:book_id
export const getBookDetail = async (req: Request, res: Response) => {
    try {
        const bookId = req.params.book_id;

        const book = await prisma.book.findUnique({
            where: { id: bookId, deletedAt: null },
            include: {
                genre: {
                    select: { name: true }
                }
            }
        });

        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        res.status(200).json({ success: true, message: 'Book detail fetched successfully', data: book });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// PATCH /books/:book_id
export const updateBook = async (req: Request, res: Response) => {
    try {
        const bookId = req.params.book_id;
        const dataToUpdate = req.body;

        const updatedBook = await prisma.book.update({
            where: { id: bookId, deletedAt: null },
            data: {
                ...dataToUpdate,
                price: dataToUpdate.price ? Number(dataToUpdate.price) : undefined,
                stockQuantity: dataToUpdate.stock_quantity ? Number(dataToUpdate.stock_quantity) : undefined,
                publicationYear: dataToUpdate.publication_year ? Number(dataToUpdate.publication_year) : undefined,
            },
        });

        res.status(200).json({ success: true, message: 'Book updated successfully', data: updatedBook });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Book not found.' });
        }
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// DELETE /books/:book_id (Soft Delete)
export const deleteBook = async (req: Request, res: Response) => {
    try {
        const bookId = req.params.book_id;

        await prisma.book.update({
            where: { id: bookId, deletedAt: null },
            data: { deletedAt: new Date() },
        });

        res.status(200).json({ success: true, message: 'Book deleted successfully (soft deleted)' });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Book not found.' });
        }
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ----------------------------------------------------------------------
// Custom Operations
// ----------------------------------------------------------------------

// GET /books/genre/:genre_id
export const getBooksByGenre = async (req: Request, res: Response) => {
    try {
        const genreId = req.params.genre_id;

        const books = await prisma.book.findMany({
            where: { genreId: genreId, deletedAt: null },
            include: {
                genre: {
                    select: { name: true }
                }
            },
            orderBy: { title: 'asc' }
        });

        if (books.length === 0) {
            return res.status(404).json({ success: false, message: 'No books found for this genre.' });
        }

        res.status(200).json({ success: true, message: `Books for genre ${genreId} fetched successfully`, data: books });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};