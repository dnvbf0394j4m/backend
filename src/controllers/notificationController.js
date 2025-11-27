import { Notification } from "../models/Notification.js";

// GET /api/notifications
export const getMyNotifications = async (req, res) => {
  try {
    const items = await Notification.find({ user: req.user._id })
      .populate("booking", "orderCode start_day end_day amount")
      .sort({ createdAt: -1 });

      console.log("getMyNotifications items:", items);
    res.json(items);
  } catch (err) {
    console.error("getMyNotifications error", err);
    res.status(500).json({ error: err.message });
  }
};
