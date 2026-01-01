const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const convertRoutes = require('./routes/convertRoutes');

// Routes
app.use('/api/convert', convertRoutes);

app.get('/', (req, res) => {
    res.send('Figma to HTML Converter API is running');
});

// Start Server
// Start Server (only if running directly)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
