var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var http = require("http");
const mongo = require("mongoose");
const cron = require("node-cron");                              // ← AJOUT
var mailRouter = require("./routes/mail");
const dbconnect = require("./config/dbconnection.json");

mongo
  .connect(dbconnect.url)
  .then(() => console.log("database connected!!"))
  .catch((err) => {
    console.log(err);
  });

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var osRouter = require("./routes/os");
var productRouter = require("./routes/products");
var userdbRouter = require("./routes/userdb");
var typeEmploiRouter = require("./routes/typeEmploi");
var offreRouter = require("./routes/offre");
const offreCtrl = require("./controller/offreController");     // ← AJOUT

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/mail", mailRouter);
// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "twig");

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/os", osRouter);
app.use("/prod", productRouter);
app.use("/userdb", userdbRouter);
app.use("/typeemploi", typeEmploiRouter);
app.use("/offre", offreRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// Clôture automatique des offres expirées
cron.schedule("* * * * *", async () => {
    try {
    const nb = await offreCtrl.cloturerOffres();
    console.log(`[CRON] ${nb} offre(s) clôturée(s)`);
  } catch (err) {
    console.log("[CRON] erreur :", err.message);
  }
});

const server = http.createServer(
  app,
  console.log("notre server en mode run!!!"),
);
server.listen(3000);

module.exports = app;