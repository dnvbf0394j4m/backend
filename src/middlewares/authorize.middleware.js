import { ROLE, ROLE_RANK } from "../constants/roles.js";

/**
 * Lấy danh sách tên role từ req.user.roles
 * - Hỗ trợ cả 2 kiểu: mảng String hoặc mảng Document đã populate có field `name`
 */
function extractRoleNames(user) {
  const roles = user?.roles || [];
  return roles.map(r => typeof r === "string" ? r : (r.name || r.code || r.role || "")).
               filter(Boolean);
}

/** YÊU CẦU có ÍT NHẤT 1 trong các role cụ thể (không xét thứ bậc) */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    const roleNames = extractRoleNames(req.user);
    const ok = roleNames.some(r => allowedRoles.includes(r));
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

/** YÊU CẦU vai trò “tối thiểu” theo thứ bậc (ví dụ: >= STAFF) */
export function requireAtLeast(minRole) {
  const minRank = ROLE_RANK[minRole] ?? 0;
  return (req, res, next) => {
    const roleNames = extractRoleNames(req.user);
    const maxUserRank = Math.max(0, ...roleNames.map(r => ROLE_RANK[r] ?? 0));
    if (maxUserRank < minRank) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

/** Ví dụ bổ sung: cho truy cập nếu là chính chủ hoặc có role tối thiểu */
export function requireSelfOrAtLeast(minRole, paramId = "id") {
  const minRank = ROLE_RANK[minRole] ?? 0;
  return (req, res, next) => {
    const isSelf = String(req.user?._id) === String(req.params[paramId]);
    if (isSelf) return next();

    const roleNames = extractRoleNames(req.user);
    const maxUserRank = Math.max(0, ...roleNames.map(r => ROLE_RANK[r] ?? 0));
    if (maxUserRank < minRank) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
