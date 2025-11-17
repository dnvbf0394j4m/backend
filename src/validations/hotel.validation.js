import Joi from "joi";
const timeRe = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const objectIdRe = /^[0-9a-fA-F]{24}$/;

export const createHotelSchema = Joi.object({
  name: Joi.string().required(),

  description: Joi.string().allow(null).empty(""),
  address: Joi.string().allow(null).empty(""),

  // cho phép string từ form-data, và sẽ convert → number
  priceHotel: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  discount: Joi.number().min(0).max(100).default(0),

  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),

  checkInTime: Joi.string().allow(null).empty("").pattern(timeRe)
    .messages({ "string.pattern.base": "checkInTime must be HH:mm" }),
  checkOutTime: Joi.string().allow(null).empty("").pattern(timeRe)
    .messages({ "string.pattern.base": "checkOutTime must be HH:mm" }),

  city: Joi.string().allow(null).empty("").pattern(objectIdRe),
  area: Joi.string().allow(null).empty("").pattern(objectIdRe),
  rating: Joi.number().min(0).max(5).default(0),
  reviewCount: Joi.number().min(0).default(0),
  tags: Joi.array().items(Joi.string()).default([]),


  // sẽ bị middleware ép = req.user.company nếu là ADMIN_HOTEL
  company: Joi.string().allow(null).empty("").pattern(objectIdRe)
});

export const updateHotelSchema = Joi.object({
  name: Joi.string().trim(),
  description: Joi.string().allow("", null),
  address: Joi.string().allow("", null),

  priceHotel: Joi.number().min(0),
  discount: Joi.number().min(0).max(100),

  lat: Joi.number(),
  lng: Joi.number(),
  location: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array().items(Joi.number()).length(2),
  }),

  checkInTime: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/).allow(null, ""),
  checkOutTime: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/).allow(null, ""),

  city: Joi.string().allow(null, ""),
  area: Joi.string().allow(null, ""),

  // ⭐ mới thêm:
  rating: Joi.number().min(0).max(5),
  reviewCount: Joi.number().min(0),
  tags: Joi.array().items(Joi.string()).default([]),

});
