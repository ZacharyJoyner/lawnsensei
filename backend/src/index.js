require('dotenv').config(); // Load environment variables
const express = require('express');
const connectDB = require('../config/db');
const app = express();
const PORT = process.env.PORT || 5000;
const cron = require('node-cron');
const LawnPlan = require('./models/LawnPlan');
const { getWeatherData } = require('./utils/weatherApi');
const sendEmail = require('./utils/email');
const cors = require('cors');
const authRoutes = require('./routes/auth'); // Correctly imported
const rateLimiter = require('./middleware/rateLimiter'); // If applicable
const authMiddleware = require('./middleware/auth'); // If you have authentication middleware
const lawnRoutes = require('./routes/lawnRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/upload');
const rateLimit = require('express-rate-limit');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Schedule a job to check weather every day at 6 am
cron.schedule('0 6 * * *', async () => {
  console.log('Running daily watering check...');

  try {
    const lawnPlans = await LawnPlan.find();
    for (const plan of lawnPlans) {
      const weatherData = await getWeatherData(plan.lawnArea.lat, plan.lawnArea.lng);
      if (weatherData.weather[0].main.toLowerCase().includes('rain')) {
        const message = `Dear user, it is expected to rain today in your area. You do not need to water your lawn today.`;
        await sendEmail(plan.userId.email, 'Lawn Care Notification', message);
        console.log(`Skipping watering for lawn plan ${plan._id} due to rain.`);
      } else {
        const message = `Dear user, we recommend watering your lawn today as no rain is expected.`;
        await sendEmail(plan.userId.email, 'Lawn Care Notification', message);
        console.log(`Recommend watering lawn plan ${plan._id}.`);
      }
    }
  } catch (err) {
    console.error('Error running daily watering check:', err);
  }
});

// Connect to the database
connectDB();

// Middleware to parse JSON request body
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Lawn Sensei API',
      version: '1.0.0',
      description: 'Lawn Sensei API Information',
    },
    servers: [
      {
        url: 'http://localhost:5000',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/lawn-plans', lawnPlanRoutes);
app.use('/api/lawns', lawnRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to Lawn Sensei Backend API');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Example of using authMiddleware for protected routes
// app.use('/api/protected', authMiddleware, protectedRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
