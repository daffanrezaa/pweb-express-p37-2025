// src/controllers/book.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// POST /books
export const createBook = async (req: Request, res: Response) => {
    try {
        // ✅ TERIMA CAMELCASE DARI FRONTEND
        const { 
            title, 
            writer, 
            publisher, 
            publicationYear,  // ✅ camelCase
            description, 
            price, 
            stockQuantity,    // ✅ camelCase
            genreId,          // ✅ camelCase
            image,
            isbn,
            condition
        } = req.body;

        // 1. Validasi Field Wajib
        if (!title || !writer || !publisher || !publicationYear || !price || stockQuantity === undefined || !genreId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Required fields: title, writer, publisher, publicationYear, price, stockQuantity, genreId' 
            });
        }

        const currentYear = new Date().getFullYear();
        const numPrice = Number(price);
        const numStock = Number(stockQuantity);
        const numPubYear = Number(publicationYear);

        // 2. Validasi Tahun Publikasi
        if (numPubYear > currentYear) {
            return res.status(400).json({ 
                success: false, 
                message: `Publication year cannot be later than ${currentYear}.` 
            });
        }
        
        // 3. Validasi Harga
        if (numPrice < 0 || isNaN(numPrice)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Price must be a non-negative number.' 
            });
        }

        // 4. Validasi Stok
        if (numStock < 0 || !Number.isInteger(numStock) || isNaN(numStock)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock must be a non-negative integer.' 
            });
        }

        // 5. Validasi Condition (jika ada)
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        if (condition && !validConditions.includes(condition)) {
            return res.status(400).json({
                success: false,
                message: `Condition must be one of: ${validConditions.join(', ')}`
            });
        }

        // ✅ PRISMA OTOMATIS MAPPING CAMELCASE -> SNAKE_CASE DI DATABASE
        const newBook = await prisma.book.create({
            data: {
                title,
                writer,
                publisher,
                publicationYear: numPubYear,  // Prisma map ke publication_year
                description: description || null,
                price: numPrice,
                stockQuantity: numStock,      // Prisma map ke stock_quantity
                genreId,                      // Prisma map ke genre_id
                image: image || null,
                isbn: isbn || null,
                condition: condition || null,
            },
            include: {
                genre: {
                    select: { id: true, name: true }
                }
            }
        });

        res.status(201).json({ success: true, message: 'Book created successfully', data: newBook });
    } catch (error: any) {
        if (error.code === 'P2002') {
             return res.status(400).json({ success: false, message: 'Title already exists.' });
        }
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// GET /books - WITH SEARCH, FILTER, SORT & PAGINATION
export const getAllBook = async (req: Request, res: Response) => {
    try {
        const { 
            search, 
            condition, 
            sortBy = 'title', 
            order = 'asc',
            page = '1',
            limit = '10'
        } = req.query;

        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = parseInt(limit as string, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        const whereClause: any = {
            deletedAt: null
        };

        if (search && typeof search === 'string' && search.trim()) {
            whereClause.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { writer: { contains: search, mode: 'insensitive' } },
                { publisher: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (condition && typeof condition === 'string' && condition.trim()) {
            whereClause.condition = condition;
        }

        let orderByClause: any = {};
        
        if (sortBy === 'publicationYear') {
            orderByClause.publicationYear = order === 'desc' ? 'desc' : 'asc';
        } else {
            orderByClause.title = order === 'desc' ? 'desc' : 'asc';
        }

        const totalItems = await prisma.book.count({
            where: whereClause
        });

        const books = await prisma.book.findMany({
            where: whereClause,
            include: {
                genre: {
                    select: { id: true, name: true }
                }
            },
            orderBy: orderByClause,
            skip: skip,
            take: limitNum
        });

        const totalPages = Math.ceil(totalItems / limitNum);

        res.status(200).json({ 
            success: true, 
            message: 'Books fetched successfully', 
            data: books,
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: limitNum
            }
        });
    } catch (error: any) {
        console.error('Error in getAllBook:', error);
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
                    select: { id: true, name: true }
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
        
        // ✅ TERIMA CAMELCASE DARI FRONTEND
        const { 
            title,
            writer,
            publisher,
            publicationYear,  // ✅ camelCase
            description,
            price,
            stockQuantity,    // ✅ camelCase
            genreId,          // ✅ camelCase
            image,
            isbn,
            condition
        } = req.body;

        const dataToUpdate: any = {};
        
        if (title !== undefined) dataToUpdate.title = title;
        if (writer !== undefined) dataToUpdate.writer = writer;
        if (publisher !== undefined) dataToUpdate.publisher = publisher;
        if (description !== undefined) dataToUpdate.description = description;
        if (genreId !== undefined) dataToUpdate.genreId = genreId;
        if (image !== undefined) dataToUpdate.image = image;
        if (isbn !== undefined) dataToUpdate.isbn = isbn;
        if (condition !== undefined) {
            const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
            if (!validConditions.includes(condition)) {
                return res.status(400).json({
                    success: false,
                    message: `Condition must be one of: ${validConditions.join(', ')}`
                });
            }
            dataToUpdate.condition = condition;
        }
        
        if (price !== undefined) {
            const numPrice = Number(price);
            if (numPrice < 0 || isNaN(numPrice)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Price must be a non-negative number.' 
                });
            }
            dataToUpdate.price = numPrice;
        }
        
        if (stockQuantity !== undefined) {
            const numStock = Number(stockQuantity);
            if (numStock < 0 || !Number.isInteger(numStock) || isNaN(numStock)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Stock must be a non-negative integer.' 
                });
            }
            dataToUpdate.stockQuantity = numStock;
        }
        
        if (publicationYear !== undefined) {
            const numPubYear = Number(publicationYear);
            const currentYear = new Date().getFullYear();
            if (numPubYear > currentYear) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Publication year cannot be later than ${currentYear}.` 
                });
            }
            dataToUpdate.publicationYear = numPubYear;
        }

        const updatedBook = await prisma.book.update({
            where: { id: bookId, deletedAt: null },
            data: dataToUpdate,
            include: {
                genre: {
                    select: { id: true, name: true }
                }
            }
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

// GET /books/genre/:genre_id
export const getBooksByGenre = async (req: Request, res: Response) => {
    try {
        const genreId = req.params.genre_id;

        const books = await prisma.book.findMany({
            where: { genreId: genreId, deletedAt: null },
            include: {
                genre: {
                    select: { id: true, name: true }
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