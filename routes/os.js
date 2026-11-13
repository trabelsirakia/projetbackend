var express = require("express");
var router = express.Router();
const os = require("os");

router.get("/show", function (req, res) {
  res.json({
    hostname: os.hostname(),
    type: os.type(),
    platform: os.platform(),
  });
});

router.get("/cpus", function (req, res) {
  res.json({
    cpus: os.cpus(),
  });
});

router.get("/cpus/:id", function (req, res) {
  const id = req.params.id;
  const nom = req.params.nom;
  console.log(id, nom);

  const cpus = os.cpus();
  res.json({ proc: cpus[id] });
});

module.exports = router;
