  // export const requireRoles = (...allowed) => (req, res, next) => {
  //   const roles = (req.user?.roles || []).map(r => (r.name || r)); // chấp nhận ['ADMIN'] hoặc [{name:'ADMIN'}]
  //   const ok = allowed.some(a => roles.includes(a));
  //   if (!ok) return res.status(403).json({ error: "Forbidden: insufficient permissions" });
  //   next();
  // };



// role.middleware.js
const norm = s => String(s || "").trim().toUpperCase();

export function requireRoles(...allowed) {
  const allow = new Set(allowed.map(norm));
  return (req, res, next) => {
    const roleNames = (req.user?.roles || []).map(norm);
    // console.log("[DEBUG] roles:", roleNames, "allowed:", [...allow]);
    const ok = roleNames.some(r => allow.has(r));
    if (!ok) return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    next();
  };
}



