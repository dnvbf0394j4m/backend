export const ROLE = {
  ADMIN: "ADMIN",
  ADMIN_HOTEL: "ADMIN_HOTEL",
  STAFF: "STAFF",
  USER: "USER",
};

// Thứ bậc (cao → thấp). Dùng cho “ít nhất là …”
export const ROLE_RANK = {
  [ROLE.ADMIN]: 4,
  [ROLE.ADMIN_HOTEL]: 3,
  [ROLE.STAFF]: 2,
  [ROLE.USER]: 1,
};
