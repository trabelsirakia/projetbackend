const TypeEmploi = require("../models/typeEmploi");

// Créer
async function add(req, res) {
  try {
    const type = await TypeEmploi.create(req.body);
    res.status(201).json(type);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Lire tous
async function getAll(req, res) {
  try {
    const types = await TypeEmploi.find();
    res.status(200).json(types);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Lire un seul
async function getById(req, res) {
  try {
    const type = await TypeEmploi.findById(req.params.id);
    if (!type) return res.status(404).json({ message: "Type introuvable" });
    res.status(200).json(type);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Modifier
async function update(req, res) {
  try {
    const type = await TypeEmploi.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!type) return res.status(404).json({ message: "Type introuvable" });
    res.status(200).json(type);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Supprimer
async function remove(req, res) {
  try {
    const type = await TypeEmploi.findByIdAndDelete(req.params.id);
    if (!type) return res.status(404).json({ message: "Type introuvable" });
    res.status(200).json({ message: "Type supprimé" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Recherche + filtre + tri + pagination
// Exemple : ?q=cd&utilise=oui&sort=nbOffres&order=desc&page=1&limit=5
async function search(req, res) {
  try {
    const { q, utilise, sort, order } = req.query;

    // 1. Recherche par nom (insensible à la casse)
    const match = {};
    if (q) {
      const motCle = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      match.nom = { $regex: motCle, $options: "i" };
    }

    // 2. Tri
    const champsAutorises = ["nom", "nbOffres"];
    const champ = champsAutorises.includes(sort) ? sort : "nom";
    const sens = order === "desc" ? -1 : 1;

    // 3. Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 5, 1);
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "offres",
          localField: "_id",
          foreignField: "typeEmploi",
          as: "offres",
        },
      },
      { $addFields: { nbOffres: { $size: "$offres" } } },
      { $project: { offres: 0, __v: 0 } },
    ];

    // 4. Filtre : types utilisés ou non par des offres
    if (utilise === "oui") pipeline.push({ $match: { nbOffres: { $gt: 0 } } });
    if (utilise === "non") pipeline.push({ $match: { nbOffres: 0 } });

    pipeline.push(
      { $sort: { [champ]: sens, _id: 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "n" }],
        },
      }
    );

    const [result] = await TypeEmploi.aggregate(pipeline);
    const total = result.total[0] ? result.total[0].n : 0;

    res.status(200).json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
      data: result.data,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Statistiques
async function stats(req, res) {
  try {
    const total = await TypeEmploi.countDocuments();

    const parType = await TypeEmploi.aggregate([
      {
        $lookup: {
          from: "offres",
          localField: "_id",
          foreignField: "typeEmploi",
          as: "offres",
        },
      },
      {
        $project: {
          _id: 0,
          type: "$nom",
          nbOffres: { $size: "$offres" },
          nbOuvertes: {
            $size: {
              $filter: {
                input: "$offres",
                as: "o",
                cond: { $eq: ["$$o.statut", "ouverte"] },
              },
            },
          },
        },
      },
      { $sort: { nbOffres: -1 } },
    ]);

    const utilises = parType.filter((t) => t.nbOffres > 0).length;

    res.status(200).json({
      total,
      utilises,
      nonUtilises: total - utilises,
      plusUtilise: parType[0] || null,
      parType,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { add, getAll, getById, update, remove, search, stats };