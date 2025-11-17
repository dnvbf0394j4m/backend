export function toUserDTO(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    roles: user.roles || [],
    company: user.company?.name || null,
    hotel: user.hotel?.name || null,
    firstLogin: user.firstLogin,
    createdAt: user.createdAt,
  };
}
