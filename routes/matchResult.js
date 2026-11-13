var express = require("express");
var router = express.Router();
const matchResultController = require("../controller/matchResultController");

// Ajout
router.post("/addmatchresult", matchResultController.createMatchResult);

//Affichage
router.get("/showallmatchresult", matchResultController.getAllMatchResults);

///Affichage par ID
router.get("/showmatchresult/:id", matchResultController.getMatchResultById);

// Les 3 fonctions de tri spécifiques
// Exemple A : Score décroissant (du plus élevé au plus faible)
router.get("/sortscoredesc", matchResultController.sortByScoreDesc);

// Exemple B : Score croissant (du plus faible au plus élevé)
router.get("/sortscoreasc", matchResultController.sortByScoreAsc);

// Exemple C : Par cvId alphabétique (croissant)
router.get("/sortcvid", matchResultController.sortByCvIdAsc);

//Filtrage
router.get("/filtermatchresult", matchResultController.getMatchResultsFiltered);

//Recherche
router.get("/searchmatchresult", matchResultController.searchMatchResults);

//Mise a jour
router.put("/updatematchresult/:id", matchResultController.updateMatchResult);

//Suppression
router.delete("/deletematchresult/:id", matchResultController.deleteMatchResult);

// ============================================================
// ROUTES METIER : Doublons
// ============================================================

// Résoudre les doublons pour un candidat + poste spécifique
router.post("/resolveduplicates", matchResultController.resolveduplicates);

// Scanner tous les doublons de la base
router.get("/scanduplicates", matchResultController.scanduplicates);

module.exports = router;
