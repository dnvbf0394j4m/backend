import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema(
  {
    // _id sẽ do Mongo tự sinh, thay cho company_id trong JPA
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    company_type: { type: String, trim: true },
    create_at: { type: Date, default: Date.now },

    // OneToMany: Company -> Users
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // OneToMany: Company -> Hotels
    hotels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hotel" }],
  },
  { timestamps: true } // thêm createdAt, updatedAt tự động
);

// Index để tìm kiếm nhanh theo tên và email
CompanySchema.index({ name: 1, email: 1 });

export const Company = mongoose.model("Company", CompanySchema);
