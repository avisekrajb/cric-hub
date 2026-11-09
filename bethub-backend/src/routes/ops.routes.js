import { Router } from "express";
import { auth, requireAdmin } from "../middleware/auth.js";
import * as opsCtrl from "../controllers/ops.controller.js";

const router = Router();

router.use(auth, requireAdmin);

router.get("/overview", opsCtrl.overview);
router.get("/pulse", opsCtrl.pulse);
router.get("/health", opsCtrl.health);
router.get("/audit", opsCtrl.auditFeed);

router.get("/tasks", opsCtrl.listTasks);
router.post("/tasks", opsCtrl.createTask);
router.patch("/tasks/:id", opsCtrl.updateTask);
router.delete("/tasks/:id", opsCtrl.deleteTask);

router.post("/matches/bulk", opsCtrl.bulkMatchAction);
router.post("/matches/:id/action", opsCtrl.matchAction);

router.get("/chat", opsCtrl.listChat);
router.patch("/chat/:id", opsCtrl.moderateChat);
router.delete("/chat/:id", opsCtrl.deleteChat);

router.get("/flags", opsCtrl.flags);
router.patch("/flags/:key", opsCtrl.setFlag);

router.get("/limits", opsCtrl.getPlatformLimits);
router.patch("/limits", opsCtrl.setPlatformLimits);
router.post("/live/enforce", opsCtrl.enforceLiveLimits);

router.post("/announce", opsCtrl.sendAnnouncement);
router.get("/livekit", opsCtrl.livekitOverview);
router.get("/export", opsCtrl.exportCsv);

export default router;
