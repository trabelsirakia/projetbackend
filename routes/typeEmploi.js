var express = require("express");
var router = express.Router();
const ctrl = require("../controller/typeEmploiController");

router.post("/add", ctrl.add);
router.get("/getall", ctrl.getAll);
router.get("/get/:id", ctrl.getById);
router.get("/search", ctrl.search);
router.get("/stats", ctrl.stats);
router.put("/update/:id", ctrl.update);
router.delete("/delete/:id", ctrl.remove);

module.exports = router;