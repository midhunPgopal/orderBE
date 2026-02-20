import { Router } from "express";
import { signup, signin, logout, refreshToken } from "./auth.controller";
import { authenticate } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/refresh-token", refreshToken);
router.post("/logout", authenticate, logout);

export default router;
