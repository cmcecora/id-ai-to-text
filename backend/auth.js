const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const mongoose = require("mongoose");

/**
 * Better Auth configuration for the backend
 * Uses MongoDB via the existing mongoose connection
 */
const createAuth = () => {
    // Get the MongoDB client from mongoose connection
    const client = mongoose.connection.getClient();
    const db = client.db(mongoose.connection.name);

    const port = process.env.PORT || 8010;

    return betterAuth({
        database: mongodbAdapter(db),
        emailAndPassword: {
            enabled: true,
        },
        // Add your secret key (should be in .env in production)
        secret: process.env.BETTER_AUTH_SECRET || "development-secret-change-in-production",
        baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
        trustedOrigins: [
            "http://localhost:4200", // Angular dev server
            "http://localhost:4201", // Alternative Angular port
            "http://localhost:4350", // Alternative frontend port
        ],
    });
};

module.exports = { createAuth };

