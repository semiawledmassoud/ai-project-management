const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

// Routes de base
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/risks',    require('./routes/risks'));

// Routes avancées — chargement sécurisé
try { app.use('/api/comments', require('./routes/comments')); console.log('✅ comments'); } catch(e) { console.log('⚠️ comments manquant'); }
try { app.use('/api/team',     require('./routes/team'));     console.log('✅ team'); }     catch(e) { console.log('⚠️ team manquant'); }
try { app.use('/api/history',  require('./routes/history'));  console.log('✅ history'); }  catch(e) { console.log('⚠️ history manquant'); }
try { app.use('/api/alerts',   require('./routes/alerts'));   console.log('✅ alerts'); }   catch(e) { console.log('⚠️ alerts manquant'); }

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.log('❌ MongoDB erreur:', err.message));

app.listen(process.env.PORT || 5000, () => {
  console.log('🚀 Serveur port', process.env.PORT || 5000);
});