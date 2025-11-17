// src/validations/user.validation.js
import Joi from "joi";

export const createUserSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).optional(),
  phone: Joi.string().optional(),
  company: Joi.string().optional().allow(null, ""),
  hotel: Joi.string().optional().allow(null, "")
  //  Bỏ roles ra khỏi client input
});

export const updateUserSchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).allow(null, ""),
  phone: Joi.string().optional(),
  company: Joi.string().allow(null, "").optional(),
  hotel: Joi.string().allow(null, "").optional()
  //  Bỏ roles ra khỏi update luôn
});

export const createStaffSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow(null, ""),
  hotelId: Joi.string().hex().length(24).required()
});
