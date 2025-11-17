import Joi from "joi";

export const createCompanySchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().allow(null, "").optional(),
  phone: Joi.string().allow(null, "").optional(),
  address: Joi.string().allow(null, "").optional(),
 company_type: Joi.string().valid("HOTEL", "SERVICE", "AGENCY", "OTHER").optional(),

   // Admin defaults
  adminName: Joi.string().required(),
  adminEmail: Joi.string().email().required(),
});

export const updateCompanySchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().allow(null, "").optional(),
  phone: Joi.string().allow(null, "").optional(),
  address: Joi.string().allow(null, "").optional(),
  company_type: Joi.string().valid("HOTEL", "SERVICE", "AGENCY", "OTHER").optional()

});
