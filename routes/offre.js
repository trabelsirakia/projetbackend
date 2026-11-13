var express = require("express");
var router = express.Router();
const ctrl = require("../controller/offreController");

router.post("/add", ctrl.add);
router.get("/getall", ctrl.getAll);
router.get("/get/:id", ctrl.getById);
router.put("/update/:id", ctrl.update);
router.delete("/delete/:id", ctrl.remove);
router.get("/search", ctrl.search);
router.put("/cloturer", ctrl.cloturer);
router.get("/stats", ctrl.stats);
router.put("/postuler/:id", ctrl.postuler);
router.post("/generer", ctrl.genererOffre);
router.get("/filtre", ctrl.filtrer);
module.exports = router;