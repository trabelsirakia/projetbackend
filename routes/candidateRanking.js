var express = require("express");
var router = express.Router();
const candidateRankingController = require("../controller/candidateRankingController");

//Ajout
router.post("/addcandidateranking", candidateRankingController.createCandidateRanking);

//Affichage
router.get("/showallcandidateranking", candidateRankingController.getAllCandidateRankings);

//Mise a jour
router.put("/updatecandidateranking/:id", candidateRankingController.updateCandidateRanking);

//Suppression
router.delete("/deletecandidateranking/:id", candidateRankingController.deleteCandidateRanking);

////Affichage par ID
router.get("/showcandidateranking/:id", candidateRankingController.getCandidateRankingById);

// Les 3 fonctions de tri spécifiques
// Exemple A : Rang croissant (du Top 1 au dernier rang)
router.get("/sortrankasc", candidateRankingController.sortByRankAsc);

// Exemple B : Score décroissant (du plus haut au plus bas)
router.get("/sortscoredesc", candidateRankingController.sortByScoreDesc);

// Exemple C : Par candidateId alphabétique (A -> Z)
router.get("/sortcandidateid", candidateRankingController.sortByCandidateIdAsc);

//Filtrage
router.get("/filtercandidateranking", candidateRankingController.getCandidateRankingsFiltered);

//Recherche
router.get("/searchcandidateranking", candidateRankingController.searchCandidateRankings);




module.exports = router;
