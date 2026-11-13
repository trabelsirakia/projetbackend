var express = require("express");
var router = express.Router();
const products = require("../products.json");

router.get("/", function (req, res) {
  res.json(products);
});
router.get("/:id", function (req, res) {
  const id = req.params.id;
  res.json(products[id]);
});

router.get("/:id/:qt", function (req, res) {
 
  res.json({
    id:req.params.id,
    qt:req.params.qt,
    unitprice:products[req.params.id].price,
    total:products[req.params.id].price *req.params.qt
  });
});

router.get("/instock/:qt", function (req, res) {
let list=[]
for(element in products){
    if(products[element].stock > req.params.qt){
        list.push(products[element])
    }
}
  res.json(list);
});




module.exports = router;
