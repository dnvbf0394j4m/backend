// src/validations/room.validation.js
import Joi from "joi";

export const createRoomSchema = Joi.object({
  hotel: Joi.string().required(),              // ObjectId KS
  name: Joi.string().trim().required(),
  description: Joi.string().allow("", null),
  price: Joi.number().min(0).required(),       // VND
  basePrice: Joi.number().min(0).allow(null),
  max_guests: Joi.number().integer().min(1).default(1),
  beds: Joi.string().allow("", null),
  size_sqm: Joi.number().min(0).allow(null),
  status: Joi.string().valid("AVAILABLE","OCCUPIED","MAINTENANCE","CLEANING","OUT_OF_SERVICE")
          .default("AVAILABLE"),
});

export const updateRoomSchema = Joi.object({
  name: Joi.string().trim(),
  description: Joi.string().allow("", null),
  price: Joi.number().min(0),
  basePrice: Joi.number().min(0).allow(null),
  max_guests: Joi.number().integer().min(1),
  beds: Joi.string().allow("", null),
  size_sqm: Joi.number().min(0).allow(null),
  status: Joi.string().valid("AVAILABLE","OCCUPIED","MAINTENANCE","CLEANING","OUT_OF_SERVICE"),
}).min(1);
