import Joi from "joi";

export const staffCreateBookingSchema = Joi.object({
  hotel: Joi.string().required(),
  start_day: Joi.date().required(),
  end_day: Joi.date().required(),
  customer: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().allow("", null),
    idNumber: Joi.string().allow("", null),
  }).required(),

  // rooms phẳng: 1 phòng = 1 object { room, price }
  rooms: Joi.array().items(
    Joi.object({
      room: Joi.string().required(),
      price: Joi.number().min(0).required(),
    })
  ).min(1).required(),

  // tổng tiền (nếu muốn BE tự tính, có thể bỏ field này và tính từ price × số đêm)
  amount: Joi.number().min(0).required(),

  deposit: Joi.number().min(0).default(0),
  note: Joi.string().allow("", null),
});

export const addPaymentSchema = Joi.object({
  amount: Joi.number().min(1).required(),
  method: Joi.string().valid("OFFLINE_CASH", "OFFLINE_CARD").required(),
  note: Joi.string().allow("", null),
});

export const queryRangeSchema = Joi.object({
  hotel: Joi.string().required(),
  from: Joi.date().required(),
  to: Joi.date().required(),
  status: Joi.string().allow("", null),
  room: Joi.string().allow("", null),
});
