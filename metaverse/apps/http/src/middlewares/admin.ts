
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import 'dotenv/config'

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(403).json({ error: 'No authorization header' });
        return;
    }

    const token = authHeader?.split(" ")[1];

    if (!token) {
        res.status(403).json({ message: "Unauthorized" })
        return
    }

    if (!process.env.JWT_SECRET) {
        res.status(403).json({ message: "Internal server error of JWT_SECRET missing" })
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string, role: string }
        if (decoded.role !== "Admin") {
            res.status(403).json({ message: 'Forbidden: Admin only' })
            return
        }
        req.userId = decoded.userId
        next()
    } catch (e) {
        console.error('Internal Error while creating map = ', e)
        res.status(401).json({ message: e })
        return
    }
}