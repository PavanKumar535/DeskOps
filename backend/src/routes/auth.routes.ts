import { Router } from "express";
import { login, logout, getCurrentUser } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema } from "../schemas/auth.schema";

const router = Router();

router.post("/login", validateBody(loginSchema), login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, getCurrentUser);

export default router;
