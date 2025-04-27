import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import connectDB from "./config/db";
import userRoutes from "./routes/userRoutes";
import cors from "cors";

// טעינת משתני סביבה
dotenv.config();

// התחברות למסד הנתונים
connectDB();

// יצירת אפליקציית Express
const app: Application = express();

// Middleware
app.use(express.json()); // לפענוח גוף הבקשה כ-JSON
app.use(cors());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
// ניתובים בסיסיים
app.get("/", (req: Request, res: Response) => {
  res.send("API is running...");
});

// שימוש בניתובי משתמשים
app.use("/api/users", userRoutes);

// הגדרת הפורט והפעלת השרת
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});
