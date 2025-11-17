import { City } from "../models/City.js";
import { createCitySchema, updateCitySchema } from "../validations/city.validation.js";

/** GET /api/cities?q=&country=&page=1&limit=20 */
export const list = async (req, res, next) => {
  try {
    const { q, country, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (q) filter.name = { $regex: q, $options: "i" };
    if (country) filter.country = { $regex: country, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      City.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)).lean(),
      City.countDocuments(filter),
    ]);

    res.json({
      data: items,
      page: Number(page),
      limit: Number(limit),
      total,
    });
  } catch (e) { next(e); }
};

/** GET /api/cities/:id */
export const detail = async (req, res, next) => {
  try {
    const city = await City.findById(req.params.id)
      // .populate("hotels", "name address priceHotel") // bật nếu cần
      .lean();
    if (!city) return res.status(404).json({ error: "City not found" });
    res.json(city);
  } catch (e) { next(e); }
};

/** POST /api/cities */
export const create = async (req, res, next) => {
  try {
    const { value, error } = createCitySchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.message });

    const doc = await City.create(value);
    res.status(201).json(doc);
  } catch (e) { next(e); }
};

/** PUT /api/cities/:id  (hoặc PATCH) */
export const update = async (req, res, next) => {
  try {
    const { value, error } = updateCitySchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.message });

    const city = await City.findByIdAndUpdate(req.params.id, value, { new: true, runValidators: true }).lean();
    if (!city) return res.status(404).json({ error: "City not found" });
    res.json(city);
  } catch (e) { next(e); }
};

/** DELETE /api/cities/:id  (xóa hẳn) */
export const remove = async (req, res, next) => {
  try {
    const del = await City.findByIdAndDelete(req.params.id).lean();
    if (!del) return res.status(404).json({ error: "City not found" });
    res.json({ message: "City deleted", id: del._id });
  } catch (e) { next(e); }
};
