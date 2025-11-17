import Joi from "joi";

export const createCitySchema = Joi.object({
  name: Joi.string().trim().required(),
  country: Joi.string().trim().allow("", null),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  url_img: Joi.string().uri().allow("", null),
});

export const updateCitySchema = Joi.object({
  name: Joi.string().trim(),
  country: Joi.string().trim().allow("", null),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  url_img: Joi.string().uri().allow("", null),
}).min(1);
