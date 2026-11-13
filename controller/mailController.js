const nodemailer = require("nodemailer");
const mailConfig = require("../config/mail.json");

const transporter = nodemailer.createTransport({
  host: mailConfig.host,
  port: mailConfig.port,
  secure: false, // true si port 465
  auth: {
    user: mailConfig.user,
    pass: mailConfig.pass,
  },
});

async function sendMail(req, res) {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res
        .status(400)
        .json({ message: "to, subject et text (ou html) sont obligatoires" });
    }

    const info = await transporter.sendMail({
      from: `"Mon App" <${mailConfig.user}>`,
      to,
      subject,
      text,
      html,
    });

    res.status(200).json({ message: "Email envoyé", id: info.messageId });
  } catch (err) {
    res.status(500).json({ message: "Erreur d'envoi", error: err.message });
  }
}

module.exports = { sendMail };