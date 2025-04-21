import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db';
import userRoutes from './routes/userRoutes';

// טעינת משתני סביבה
dotenv.config();

// התחברות למסד הנתונים
connectDB();

// יצירת אפליקציית Express
const app: Application = express();

// Middleware
app.use(express.json()); // לפענוח גוף הבקשה כ-JSON

// ניתובים בסיסיים
app.get('/', (req: Request, res: Response) => {
  res.send('API is running...');
});

// שימוש בניתובי משתמשים
app.use('/api/users', userRoutes);

// הגדרת הפורט והפעלת השרת
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});