// src/controllers/book.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Helper for filter and pagination
const parseQuery = (req: Request) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    
    return { page, limit, skip, search };
}

// POST /books
export const createBook = async (req: Request, res: Response) => {
    // Using SNAKE_CASE from req.body
    const { 
        title, writer, publisher, publication_year, description, 
        price, stock_quantity, genre_id 
    } = req.body;

    // Required Input Validation
    if (!title || !writer || !publisher || publication_year === undefined || price === undefined || stock_quantity === undefined || !genre_id) {
        return res.status(400).json({ message: "Required book data (title, writer, publisher, year, price, stock, genre ID) must be filled." });
    }

    try {
        // Check for Duplicate Title
        const existingBook = await prisma.book.findUnique({ where: { title } });
        if (existingBook) {
            return res.status(409).json({ message: "A book with the same title already exists." });
        }
        
        // Check for Genre Existence
        const genreExists = await prisma.genre.findUnique({ where: { id: genre_id } });
        if (!genreExists) {
            return res.status(400).json({ message: "Invalid or non-existent Genre ID." });
        }

        // Create Book (using Prisma CamelCase properties for data)
        const newBook = await prisma.book.create({
            data: {
                title, writer, publisher, description,
                publicationYear: Number(publication_year), // Mapped to publication_year in DB
                price: Number(price), // Converted to Integer
                stockQuantity: Number(stock_quantity),     // Mapped to stock_quantity in DB
                genreId: genre_id,                         // Mapped to genre_id in DB
            },
            include: { genre: true },
        });

        return res.status(201).json({ message: "Book successfully added.", data: newBook });

    } catch (error) {
        console.error("Error creating book:", error);
        return res.status(500).json({ message: "A server error occurred while creating the book." });
    }
};

// GET /books (Filter & Pagination)
export const getAllBook = async (req: Request, res: Response) => {
    const { page, limit, skip, search } = parseQuery(req);
    const where: any = {};
    
    if (search) {
        // Filter by Title OR Writer
        where.OR = [
            { title: { contains: search, mode: 'insensitive' as const } },
            { writer: { contains: search, mode: 'insensitive' as const } },
        ];
    }

    try {
        const [books, totalCount] = await prisma.$transaction([
            prisma.book.findMany({
                skip: skip,
                take: limit,
                where: where,
                include: { genre: true }, 
                orderBy: { title: 'asc' }, 
            }),
            prisma.book.count({ where: where }),
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            message: "Book list successfully retrieved.",
            meta: { 
                total_items: totalCount, 
                current_page: page, 
                total_pages: totalPages, 
                limit: limit, 
            },
            data: books,
        });
    } catch (error) {
        console.error("Error getting all books:", error);
        return res.status(500).json({ message: "A server error occurred while retrieving book data." });
    }
};

// GET /books/:book_id
export const getBookDetail = async (req: Request, res: Response) => {
    const book_id = req.params.book_id; 

    try {
        const book = await prisma.book.findUnique({
            where: { id: book_id },
            include: { genre: true }
        });

        if (!book) {
            return res.status(404).json({ message: "Book not found." });
        }

        return res.status(200).json({ message: "Book details successfully retrieved.", data: book });

    } catch (error) {
        console.error("Error getting book detail:", error);
        return res.status(500).json({ message: "Server error occurred or Book ID is invalid." });
    }
};

// GET /books/genre/:genre_id (Filter & Pagination)
export const getBooksByGenre = async (req: Request, res: Response) => {
    const genre_id = req.params.genre_id; 
    const { page, limit, skip, search } = parseQuery(req);
    
    // Check for Genre existence
    const genreExists = await prisma.genre.findUnique({ where: { id: genre_id } });
    if (!genreExists) {
        return res.status(404).json({ message: "Genre not found." });
    }

    const where: any = { genreId: genre_id }; 
    
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' as const } },
            { writer: { contains: search, mode: 'insensitive' as const } },
        ];
    }

    try {
        const [books, totalCount] = await prisma.$transaction([
            prisma.book.findMany({
                skip: skip,
                take: limit,
                where: where,
                include: { genre: true }, 
                orderBy: { title: 'asc' }, 
            }),
            prisma.book.count({ where: where }),
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return res.status(200).json({
            message: `Book list in ${genreExists.name} genre successfully retrieved.`,
            meta: { total_items: totalCount, current_page: page, total_pages: totalPages, limit: limit, },
            data: books,
        });
    } catch (error) {
        console.error("Error getting books by genre:", error);
        return res.status(500).json({ message: "A server error occurred while retrieving book data by genre." });
    }
};


// PATCH /books/:book_id
export const updateBook = async (req: Request, res: Response) => {
    const book_id = req.params.book_id;
    
    // Destructuring all body fields (snake_case)
    const { 
        title, writer, publisher, publication_year, description, 
        price, stock_quantity, genre_id 
    } = req.body;
    
    const dataToUpdate: any = {};
    
    try {
        // 1. Check for duplicate title if title is updated
        if (title) {
            const existingBook = await prisma.book.findUnique({ where: { title } });
            if (existingBook && existingBook.id !== book_id) {
                return res.status(409).json({ message: "Failed to update. A book with this title already exists." });
            }
            dataToUpdate.title = title;
        }

        // 2. Check for genre existence if genre_id is updated
        if (genre_id) {
            const genreExists = await prisma.genre.findUnique({ where: { id: genre_id } });
            if (!genreExists) {
                return res.status(400).json({ message: "Invalid or non-existent Genre ID." });
            }
            dataToUpdate.genreId = genre_id; // Using Prisma property: genreId
        }

        // 3. Prepare other data for update (using Prisma CamelCase properties)
        if (writer !== undefined) dataToUpdate.writer = writer;
        if (publisher !== undefined) dataToUpdate.publisher = publisher;
        if (publication_year !== undefined) dataToUpdate.publicationYear = Number(publication_year);
        if (description !== undefined) dataToUpdate.description = description;
        if (price !== undefined) dataToUpdate.price = Number(price);
        if (stock_quantity !== undefined) dataToUpdate.stockQuantity = Number(stock_quantity);

        const updatedBook = await prisma.book.update({
            where: { id: book_id },
            data: dataToUpdate,
            include: { genre: true }
        });

        return res.status(200).json({ message: "Book data successfully updated.", data: updatedBook });

    } catch (error) {
        if ((error as any).code === 'P2025') { 
            return res.status(404).json({ message: "Book not found." });
        }
        console.error("Error updating book:", error);
        return res.status(500).json({ message: "Server error occurred." });
    }
};

// DELETE /books/:book_id
export const deleteBook = async (req: Request, res: Response) => {
    const book_id = req.params.book_id; 

    try {
        // Delete Book
        await prisma.book.delete({ where: { id: book_id } });

        return res.status(200).json({ message: "Book successfully deleted." });

    } catch (error) {
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ message: "Book not found." });
        }
        // P2003: Foreign key constraint failed (Book is still tied to Order Items)
        if ((error as any).code === 'P2003') { 
            return res.status(409).json({ 
                message: "Cannot delete book. This book still has purchase history (Order Items)." 
            });
        }
        console.error("Error deleting book:", error);
        return res.status(500).json({ message: "Server error occurred." });
    }
};