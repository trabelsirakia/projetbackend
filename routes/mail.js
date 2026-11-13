var express = require("express");
var router = express.Router();
const mailCtrl = require("../controller/mailController");

router.post("/send", mailCtrl.sendMail);

module.exports = router;