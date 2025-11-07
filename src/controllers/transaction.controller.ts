// src/controllers/transaction.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Book, Prisma } from '@prisma/client'; 

// Definisikan tipe untuk input item pesanan
interface OrderItemInput {
    book_id: string; 
    quantity: number;
}

// POST /transactions
export const createTransaction = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { items } = req.body as { items: OrderItemInput[] };

  if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
  }

  const stockUpdates = new Map<string, number>();
  let totalQuantity = 0;
  let totalPrice = 0;
  
  // START VALIDASI DATA INPUT TAMBAHAN (KUANTITAS TIDAK BOLEH DESIMAL)
  for (const item of items) {
      const numQuantity = Number(item.quantity);
      if (numQuantity <= 0 || !Number.isInteger(numQuantity) || isNaN(numQuantity)) {
           return res.status(400).json({ 
              success: false, 
              message: `Quantity for book ${item.book_id} must be a positive integer.` 
          });
      }
      item.quantity = numQuantity; // Pastikan quantity adalah number (meski sudah dilakukan di type assertion)
  }
  // END VALIDASI DATA INPUT TAMBAHAN

  // START VALIDASI STOK & DATA BUKU
  try {
      const bookIds = items.map((item) => item.book_id);
      const books = await prisma.book.findMany({
          where: { id: { in: bookIds }, deletedAt: null }, 
      });
      
      // ... (sisanya sama, logika validasi stok kritis sudah ada)
      const availableBooks = new Map<string, Book>(books.map(book => [book.id, book]));

      if (books.length !== bookIds.length) {
          return res.status(404).json({ success: false, message: 'Some books not found or are inactive.' });
      }
      
      for (const item of items) {
          const book: Book | undefined = availableBooks.get(item.book_id);
          
          // NOTE: Validasi item.quantity <= 0 sudah dilakukan di awal loop.
          
          // VALIDASI STOK KRITIS
          if (book!.stockQuantity < item.quantity) {
              return res.status(409).json({ 
                  success: false,
                  message: `Stock for '${book!.title}' is insufficient. Available: ${book!.stockQuantity}, Requested: ${item.quantity}.` 
              });
          }

          totalQuantity += item.quantity;
          totalPrice += book!.price * item.quantity;
          stockUpdates.set(book!.id, book!.stockQuantity - item.quantity);
      }

  } catch (error) {
      console.error("Error during initial validation:", error);
      return res.status(500).json({ success: false, message: "Server error during validation." });
  }
  // END VALIDASI STOK & DATA BUKU

  // START PRISMA TRANSACTION
  try {
      // ... (Semua logika transaksi di sini tetap sama)
      const [order] = await prisma.$transaction(async (tx: Prisma.TransactionClient) => { 
          
          // 1. Buat Order (Induk) dan Order Items (Detail)
          const newOrder = await tx.order.create({
              data: {
                  userId: userId,
                  orderItems: {
                      create: items.map((item) => ({
                          bookId: item.book_id,
                          quantity: item.quantity,
                      })),
                  },
              },
          });

          // 2. Kurangi Stok Buku (Update)
          const stockUpdatePromises = Array.from(stockUpdates.entries()).map(([bookId, newStock]) => 
              tx.book.update({
                  where: { id: bookId },
                  data: { stockQuantity: newStock },
              })
          );

          await Promise.all(stockUpdatePromises);

          return [newOrder];
      });

      return res.status(201).json({
          success: true,
          message: 'Transaction created successfully and stock updated.',
          data: {
              transaction_id: order.id,
              total_quantity: totalQuantity,
              total_price: totalPrice,
          },
      });

  } catch (error) {
      console.error("Error transaction failure:", error);
      return res.status(500).json({
          success: false,
          message: 'Transaction failed. Stock remains unchanged.',
      });
  }
};

// GET /transactions (Riwayat Transaksi Pengguna)
export const getAllTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const transactions = await prisma.order.findMany({
      where: { userId: userId }, 
      orderBy: { createdAt: 'desc' }, 
      include: {
        user: { select: { id: true, username: true, email: true } }, 
        orderItems: {
          include: { 
            book: { select: { title: true, price: true } }
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Your transactions history fetched successfully',
      data: transactions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// GET /transactions/:id (Detail Transaksi Pengguna)
export const getTransactionDetail = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const transaction = await prisma.order.findUnique({
      where: { 
          id: id,
          userId: userId 
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
        orderItems: {
          include: { 
            book: { 
                select: { 
                    title: true, writer: true, publisher: true, price: true 
                } 
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or you do not have access',
      });
    }

    return res.json({
      success: true,
      message: 'Transaction detail fetched successfully',
      data: transaction,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// GET /transactions/statistics (Statistik Transaksi Keseluruhan)
export const getTransactionStatistics = async (req: Request, res: Response) => {
  try {
    const totalTransactions = await prisma.order.count();

    const allOrders = await prisma.order.findMany({
      include: {
        orderItems: { include: { book: { include: { genre: true } } } },
      },
    });

    let totalPrice = 0;
    const genreCount: Record<string, number> = {}; // Menghitung kuantitas buku terjual per genre

    for (const order of allOrders) {
      for (const item of order.orderItems) {
        const subtotal = item.book.price * item.quantity;
        totalPrice += subtotal;
        
        // Menghitung buku terjual berdasarkan nama genre
        const genreName = item.book.genre?.name || "Unknown Genre";
        genreCount[genreName] = (genreCount[genreName] || 0) + item.quantity; // Menjumlahkan kuantitas
      }
    }

    const averageTransactionValue =
      totalTransactions > 0 ? totalPrice / totalTransactions : 0;

    const sortedGenres = Object.entries(genreCount).sort(
      (a, b) => b[1] - a[1]
    );

    // Ambil genre terpopuler dan terkurang
    const mostPopularGenre = sortedGenres[0]?.[0] || null;
    const leastPopularGenre =
      sortedGenres.length > 0 ? sortedGenres[sortedGenres.length - 1][0] : null; // Ubah logic pengecekan array

    return res.json({
      success: true,
      message: 'Get transactions statistics successfully',
      data: {
        // --- NAMA FIELD DISESUAIKAN DI SINI ---
        total_transactions: totalTransactions,
        average_transaction_amount: averageTransactionValue,
        most_book_sales_genre: mostPopularGenre,
        fewest_book_sales_genre: leastPopularGenre,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};