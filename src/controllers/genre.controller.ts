import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// POST /genre
export const createGenre = async (req: Request, res: Response) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ message: "Genre must be filled." });
    }

    try {
        // When checking for existence, also check if the existing genre is SOFT-DELETED.
        const existingGenre = await prisma.genre.findFirst({ 
            where: { 
                name,
                // Only consider genres that are not deleted (or soft-deleted)
                deletedAt: null 
            } 
        });

        if (existingGenre) {
            return res.status(409).json({ message: "Failed. This Genre already existed." });
        }

        const genre = await prisma.genre.create({ data: { name } });
        return res.status(201).json({ message: "Genre successfully added.", data: genre });

    } catch (error) {
        console.error("Error creating genre:", error);
        return res.status(500).json({ message: "Server failed in making genre." });
    }
};

// GET /genre
export const getAllGenre = async (req: Request, res: Response) => {
    try {
        const genres = await prisma.genre.findMany({
             // ✅ Filter: Only retrieve genres where deletedAt is NULL
             where: { deletedAt: null },
             orderBy: { name: 'asc' }
        });
        return res.status(200).json({ message: "List of genres retrieved successfully.", data: genres });
    } catch (error) {
        console.error("Error getting all genres:", error);
        return res.status(500).json({ message: "Server error occurred." });
    }
};

// GET /genre/:genre_id
export const getGenreDetail = async (req: Request, res: Response) => {
    const genreId = req.params.genre_id;

    try {
        const genre = await prisma.genre.findUnique({
            where: { 
                id: genreId,
                deletedAt: null 
            },
        });

        if (!genre) {
            // This handles both not found and soft-deleted cases
            return res.status(404).json({ message: "Genre not found" });
        }

        return res.status(200).json({ message: "Detail genre retrieved successfully.", data: genre });

    } catch (error) {
        console.error("Error getting genre detail:", error);
        return res.status(500).json({ message: "Server error or invalid Genre ID." });
    }
};

// PATCH /genre/:genre_id
export const updateGenre = async (req: Request, res: Response) => {
    const genreId = req.params.genre_id;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Genre name is required for update." });
    }

    try {
        // Check duplication: check for active genres with the new name
        const existingGenre = await prisma.genre.findFirst({ 
            where: { 
                name,
                deletedAt: null, // Only check ACTIVE genres
                NOT: { id: genreId } // Exclude the genre being updated
            } 
        });
        
        if (existingGenre) {
            return res.status(409).json({ message: "Update failed. A genre with this new name already exists." });
        }
        
        const updatedGenre = await prisma.genre.update({
            where: { 
                id: genreId,
                deletedAt: null // Only allow update on non-deleted records
            },
            data: { name },
        });

        return res.status(200).json({ message: "Genre successfully updated.", data: updatedGenre });

    } catch (error) {
        // Error P2025: Record to update not found (either ID is wrong or it was soft-deleted)
        if ((error as any).code === 'P2025') { 
            return res.status(404).json({ message: "Genre not found." });
        }
        console.error("Error updating genre:", error);
        return res.status(500).json({ message: "Server error occurred." });
    }
};

// DELETE /genre/:genre_id
export const deleteGenre = async (req: Request, res: Response) => {
    const genreId = req.params.genre_id;

    try {
        // 1. Check if any book is still using this active genre
        const booksCount = await prisma.book.count({ where: { genreId: genreId } });

        if (booksCount > 0) {
            return res.status(409).json({ 
                message: `Cannot delete genre. There are ${booksCount} books still using this genre.` 
            });
        }

        // 2. SOFT DELETE: Update the deletedAt column with the current timestamp
        const deletedGenre = await prisma.genre.update({ 
            where: { 
                id: genreId, 
                deletedAt: null // Ensure we are only 'deleting' an active record
            },
            data: { deletedAt: new Date() } 
        });

        return res.status(200).json({ message: "Genre successfully deleted (Soft Deleted)." });

    } catch (error) {
        // Error P2025: Record not found (ID is wrong OR it was already soft-deleted)
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ message: "Genre not found (or already deleted)." });
        }
        console.error("Error deleting genre:", error);
        return res.status(500).json({ message: "Server errors occurred." });
    }
};