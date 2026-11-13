const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Offre = new Schema(
  {
    titre: {
      type: String,
      required: [true, "Le titre est obligatoire"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    typeEmploi: {
      type: Schema.Types.ObjectId,
      ref: "TypeEmploi",
      required: true,
    },
    date_limite: {
      type: Date,
      required: [true, "La date limite est obligatoire"],
    },
    statut: {
      type: String,
      enum: ["ouverte", "cloturee"],
      default: "ouverte",
    },
    // pour l'étape 8 (compteur de candidatures)
    nbCandidatures: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Offre", Offre);