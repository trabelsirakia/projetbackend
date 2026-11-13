const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TypeEmploi = new Schema({
  nom: {
    type: String,
    required: [true, "Le nom est obligatoire"],
    unique: true,
    trim: true,
  },
});

module.exports = mongoose.model("TypeEmploi", TypeEmploi);