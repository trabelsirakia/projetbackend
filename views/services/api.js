import api from './client';

/** Appels de l'API, regroupés par ressource. Chaque fonction renvoie le corps JSON { success, message, data }. */
const get = (url, params, signal) => api.get(url, { params, signal }).then((r) => r.data);
const post = (url, body, config) => api.post(url, body, config).then((r) => r.data);
const patch = (url, body) => api.patch(url, body).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

// Retire les filtres vides avant l'envoi (la validation refuse les chaînes vides sur les énumérations).
export const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const authApi = {
  login: (body) => post('/auth/login', body),
  signup: (body) => post('/auth/signup', body),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),
  updateMe: (body) => patch('/auth/me', body),
  changePassword: (body) => post('/auth/change-password', body),
  forgot: (email) => post('/auth/forgot-password', { email }),
  reset: (token, password) => post('/auth/reset-password', { token, password }),
};

export const jobsApi = {
  metiers: () => get('/metiers'),
  list: (params, signal) => get('/jobs', clean(params), signal),
  get: (id) => get(`/jobs/${id}`),
  create: (body) => post('/jobs', body),
  update: (id, body) => patch(`/jobs/${id}`, body),
  remove: (id) => del(`/jobs/${id}`),
};

export const applicationsApi = {
  apply: ({ jobId, coverLetter, file }, onUploadProgress) => {
    const form = new FormData();
    form.append('jobId', jobId);
    if (coverLetter) form.append('coverLetter', coverLetter);
    form.append('cv', file);
    return post('/applications', form, { onUploadProgress, timeout: 120000 });
  },
  list: (params, signal) => get('/applications', clean(params), signal),
  get: (id) => get(`/applications/${id}`),
  cvUrl: (id) => `/api/applications/${id}/cv`,
  cvBlob: (id) => api.get(`/applications/${id}/cv`, { responseType: 'blob' }).then((r) => r.data),
  invite: (id) => post(`/applications/${id}/invite`),
  reject: (id, note) => post(`/applications/${id}/reject`, { note }),
  withdraw: (id) => post(`/applications/${id}/withdraw`),
  quiz: (id) => get(`/applications/${id}/quiz`),
  startQuiz: (id) => post(`/applications/${id}/quiz/start`),
};

export const quizzesApi = {
  list: (params, signal) => get('/quizzes', clean(params), signal),
  get: (id) => get(`/quizzes/${id}`),
  create: (body) => post('/quizzes', body),
  update: (id, body) => patch(`/quizzes/${id}`, body),
  remove: (id) => del(`/quizzes/${id}`),
  duplicate: (id) => post(`/quizzes/${id}/duplicate`),
  generate: (body) => post('/quizzes/generate', body, { timeout: 180000 }),
  stats: (params) => get('/quizzes/stats', clean(params || {})),
  attempts: (id, params) => get(`/quizzes/${id}/attempts`, clean(params || {})),
  submit: (attemptId, answers) => post(`/quiz-attempts/${attemptId}/submit`, { answers }),
  attempt: (attemptId) => get(`/quiz-attempts/${attemptId}`),
};

export const interviewsApi = {
  list: (params, signal) => get('/interviews', clean(params), signal),
  get: (id) => get(`/interviews/${id}`),
  create: (body) => post('/interviews', body),
  update: (id, body) => patch(`/interviews/${id}`, body),
  remove: (id) => del(`/interviews/${id}`),
  start: (id, language) => post(`/interviews/${id}/start`, { language }, { timeout: 120000 }),
  answerAudio: (id, { questionIndex, wav, durationSec, liveTranscript }) => {
    const form = new FormData();
    form.append('questionIndex', String(questionIndex));
    form.append('durationSec', String(Math.round(durationSec)));
    if (liveTranscript) form.append('liveTranscript', liveTranscript.slice(0, 4900));
    form.append('audio', wav, `reponse-${questionIndex + 1}.wav`);
    return post(`/interviews/${id}/answers`, form, { timeout: 120000 });
  },
  answerText: (id, questionIndex, transcript) => post(`/interviews/${id}/answers`, { questionIndex, transcript }),
  finish: (id) => post(`/interviews/${id}/finish`),
  reevaluate: (id) => post(`/interviews/${id}/evaluate`, null, { timeout: 300000 }),
  decide: (id, body) => post(`/interviews/${id}/decision`, body),
  stats: (params) => get('/interviews/stats', clean(params || {})),
};

export const chatbotApi = {
  send: (message, history) => post('/chatbot/message', { message, history }, { timeout: 150000 }),
  practice: (metier) => get('/chatbot/practice', { metier }),
  evaluate: (question, answer) => post('/chatbot/practice/evaluate', { question, answer }, { timeout: 120000 }),
};

export const statsApi = {
  overview: () => get('/stats/overview'),
  ai: () => get('/system/ai'),
};

export const usersApi = {
  list: (params, signal) => get('/users', clean(params), signal),
  create: (body) => post('/users', body),
  update: (id, body) => patch(`/users/${id}`, body),
  remove: (id) => del(`/users/${id}`),
};
