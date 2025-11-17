import { Router } from "express";
import { Role } from "../models/Role.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { role_id, description } = req.body;
    const role = await Role.create({ _id: role_id, description });
    res.status(201).json(role);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/", async (req, res) => {
  const roles = await Role.find().lean();
  res.json(roles);
});

export default router;
