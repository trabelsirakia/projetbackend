/** Contrôleurs HTTP (un fichier par ressource ; la logique métier est dans controller/services et controller/ai). */
const system = require('./systemController');

module.exports = {
  users: require('./userController'),
  jobs: require('./jobController'),
  applications: require('./applicationController'),
  quizzes: require('./quizController'),
  interviews: require('./interviewController'),
  chatbot: require('./chatbotController'),
  stats: system,
  system,
};
