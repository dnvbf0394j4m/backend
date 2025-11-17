// middlewares/validate.middleware.js
export const validate = (schema) => (req, res, next) => {
  const options = {
    abortEarly: false,
    convert: true,
    stripUnknown: true
  };

  const { value, error } = schema.validate(req.body, options);

  if (error) {
    // Gom lỗi ngắn gọn
    const msg = error.details.map(d => d.message.replace(/\"/g, "'")).join(". ");
    return res.status(400).json({ error: msg });
  }

  req.validated = value; // giữ bản đã ép kiểu/sạch
  next();
};
