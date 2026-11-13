var express = require("express");
var router = express.Router();
const userController=require('../controller/UserController')

router.post("/addwithpost", userController.adduser);

router.get("/showalluser", userController.showalluser);

router.get("/showuser/:id", userController.showuser);

router.delete("/deleteuser/:id", userController.deleteuser);

router.put("/updateuser/:id", userController.updateuser);

router.get("/add/:name/:cin/:email", function (req, res, next) {
  new User({
    name: req.params.name,
    cin: req.params.cin,
    email: req.params.email,
  }).save();
  res.send("good added");
});

module.exports = router;
