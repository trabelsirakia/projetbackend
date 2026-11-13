const Offre = require("../models/offre");
const { genererDescription } = require("../services/iaService");

// Créer
// - clôture immédiate si la date limite est déjà dépassée
// - description générée par l'IA si elle est absente
async function add(req, res) {
  try {
    const data = { ...req.body };

    // 1) Clôture immédiate si la date limite est dépassée
    const dateLimite = new Date(data.date_limite);
    if (!isNaN(dateLimite) && dateLimite < new Date()) {
      data.statut = "cloturee";
    }

    // 2) Description générée par l'IA si absente ou vide
    if (!data.description || !data.description.trim()) {
      const resultat = await genererDescription({
        titre: data.titre,
        entreprise: data.entreprise,
        lieu: data.lieu,
        contrat: data.contrat,
        competences: data.competences,
      });
      data.description = resultat.texte;
    }

    const offre = await Offre.create(data);
    const result = await offre.populate("typeEmploi");
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Lire toutes
async function getAll(req, res) {
  try {
    const offres = await Offre.find().populate("typeEmploi");
    res.status(200).json(offres);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Lire une seule
async function getById(req, res) {
  try {
    const offre = await Offre.findById(req.params.id).populate("typeEmploi");
    if (!offre) return res.status(404).json({ message: "Offre introuvable" });
    res.status(200).json(offre);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Modifier
// Si la date limite change, le statut suit automatiquement
async function update(req, res) {
  try {
    const data = { ...req.body };

    if (data.date_limite) {
      const d = new Date(data.date_limite);
      if (!isNaN(d)) {
        data.statut = d < new Date() ? "cloturee" : "ouverte";
      }
    }

    const offre = await Offre.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    }).populate("typeEmploi");
    if (!offre) return res.status(404).json({ message: "Offre introuvable" });
    res.status(200).json(offre);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Supprimer
async function remove(req, res) {
  try {
    const offre = await Offre.findByIdAndDelete(req.params.id);
    if (!offre) return res.status(404).json({ message: "Offre introuvable" });
    res.status(200).json({ message: "Offre supprimée" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Recherche + filtre + tri + pagination
async function search(req, res) {
  try {
    const { q, type, statut, sort, order } = req.query;
    const filter = {};

    if (q) {
      const motCle = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { titre: { $regex: motCle, $options: "i" } },
        { description: { $regex: motCle, $options: "i" } },
      ];
    }
    if (type) filter.typeEmploi = type;
    if (statut) filter.statut = statut;

    // Tri
    const champsAutorises = ["date_limite", "titre", "createdAt"];
    const champ = champsAutorises.includes(sort) ? sort : "createdAt";
    const sens = order === "asc" ? 1 : -1;

    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 5, 1);
    const skip = (page - 1) * limit;

    const total = await Offre.countDocuments(filter);
    const offres = await Offre.find(filter)
      .populate("typeEmploi")
      .sort({ [champ]: sens })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
      data: offres,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Clôturer les offres dont la date limite est dépassée (utilisé par le cron)
async function cloturerOffres() {
  const result = await Offre.updateMany(
    { statut: "ouverte", date_limite: { $lt: new Date() } },
    { $set: { statut: "cloturee" } }
  );
  return result.modifiedCount;
}

// Route manuelle pour tester
async function cloturer(req, res) {
  try {
    const nb = await cloturerOffres();
    res.status(200).json({ message: `${nb} offre(s) clôturée(s)` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Statistiques
async function stats(req, res) {
  try {
    await cloturerOffres(); // pour que les chiffres soient à jour

    const total = await Offre.countDocuments();

    const parStatut = await Offre.aggregate([
      { $group: { _id: "$statut", nombre: { $sum: 1 } } },
    ]);

    const parType = await Offre.aggregate([
      { $group: { _id: "$typeEmploi", nombre: { $sum: 1 } } },
      {
        $lookup: {
          from: "typeemplois",
          localField: "_id",
          foreignField: "_id",
          as: "type",
        },
      },
      { $unwind: "$type" },
      { $project: { _id: 0, type: "$type.nom", nombre: 1 } },
    ]);

    res.status(200).json({ total, parStatut, parType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Postuler : incrémente le compteur de candidatures
async function postuler(req, res) {
  try {
    const offre = await Offre.findById(req.params.id);
    if (!offre) return res.status(404).json({ message: "Offre introuvable" });

    if (offre.statut === "cloturee" || offre.date_limite < new Date()) {
      return res.status(400).json({ message: "Offre clôturée : candidature impossible" });
    }

    offre.nbCandidatures += 1;
    await offre.save();
    await offre.populate("typeEmploi");
    res.status(200).json(offre);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// Générer la description avec l'IA
// - avec un id (dans l'URL ou dans le body "_id") : la description est
//   enregistrée dans l'offre correspondante
// - sans id : le texte est seulement renvoyé (rien n'est enregistré)
async function genererOffre(req, res) {
  try {
    const id = req.params.id || req.body._id;
    const { entreprise, lieu, contrat, competences } = req.body;
    let titre = req.body.titre;
    let offre = null;

    // Si un id est fourni, on récupère l'offre pour utiliser son titre
    if (id) {
      offre = await Offre.findById(id);
      if (!offre) return res.status(404).json({ message: "Offre introuvable" });
      titre = offre.titre;
    }

    if (!titre) {
      return res.status(400).json({ message: "Le titre du poste est obligatoire." });
    }

    const resultat = await genererDescription({
      titre,
      entreprise,
      lieu,
      contrat,
      competences,
    });

    // Sans id : on renvoie seulement le texte
    if (!offre) return res.status(200).json(resultat);

    // Avec id : on enregistre la description dans la base
    const misAJour = await Offre.findByIdAndUpdate(
      id,
      { description: resultat.texte },
      { new: true }
    ).populate("typeEmploi");

    res.status(200).json({ source: resultat.source, offre: misAJour });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// Filtre par critères (sans mot-clé)
async function filtrer(req, res) {
  try {
    const { type, statut, avant, apres, minCandidatures, maxCandidatures, sort, order } = req.query;
    const filter = {};

    if (type) filter.typeEmploi = type;

    if (statut) {
      if (!["ouverte", "cloturee"].includes(statut)) {
        return res.status(400).json({ message: "statut doit être 'ouverte' ou 'cloturee'" });
      }
      filter.statut = statut;
    }

    // Intervalle de date limite (AAAA-MM-JJ)
    if (apres || avant) {
      filter.date_limite = {};
      if (apres) {
        const d = new Date(apres);
        if (isNaN(d)) return res.status(400).json({ message: "Date 'apres' invalide (AAAA-MM-JJ)" });
        filter.date_limite.$gte = d;
      }
      if (avant) {
        const d = new Date(avant);
        if (isNaN(d)) return res.status(400).json({ message: "Date 'avant' invalide (AAAA-MM-JJ)" });
        filter.date_limite.$lte = d;
      }
    }

    // Intervalle de candidatures
    if (minCandidatures !== undefined || maxCandidatures !== undefined) {
      filter.nbCandidatures = {};
      if (minCandidatures !== undefined) {
        const min = parseInt(minCandidatures);
        if (isNaN(min)) return res.status(400).json({ message: "minCandidatures doit être un nombre" });
        filter.nbCandidatures.$gte = min;
      }
      if (maxCandidatures !== undefined) {
        const max = parseInt(maxCandidatures);
        if (isNaN(max)) return res.status(400).json({ message: "maxCandidatures doit être un nombre" });
        filter.nbCandidatures.$lte = max;
      }
    }

    // Tri
    const champsAutorises = ["date_limite", "titre", "createdAt", "nbCandidatures"];
    const champ = champsAutorises.includes(sort) ? sort : "createdAt";
    const sens = order === "asc" ? 1 : -1;

    const offres = await Offre.find(filter)
      .populate("typeEmploi")
      .sort({ [champ]: sens });

    res.status(200).json({ total: offres.length, data: offres });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = {
  add,
  getAll,
  getById,
  update,
  remove,
  search,
  cloturerOffres,
  cloturer,
  stats,
  postuler,
  genererOffre,
  filtrer,
};