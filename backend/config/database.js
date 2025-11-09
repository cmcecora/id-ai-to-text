const mongoose = require('mongoose');

/**
 * Database Configuration - Laravel-inspired MongoDB setup
 * This replaces Laravel's config/database.php for MongoDB
 */
class DatabaseConnection {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    /**
     * Connect to MongoDB
     */
    async connect() {
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/id_ocr_db';
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10, // Maximum connection pool size
                serverSelectionTimeoutMS: 5000, // Server selection timeout
                socketTimeoutMS: 45000, // Socket timeout
                bufferMaxEntries: 0, // Disable mongoose buffering
                bufferCommands: false, // Disable mongoose buffering
            };

            console.log('Connecting to MongoDB...');
            this.connection = await mongoose.connect(mongoUri, options);
            this.isConnected = true;

            console.log('✅ MongoDB connected successfully');
            console.log(`   Database: ${mongoose.connection.name}`);
            console.log(`   Host: ${mongoose.connection.host}`);
            console.log(`   Port: ${mongoose.connection.port}`);

            // Handle connection events
            this.setupEventHandlers();

            return this.connection;

        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
                console.log('MongoDB disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }

    /**
     * Check if connected
     */
    isDbConnected() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            status: states[mongoose.connection.readyState],
            isConnected: this.isDbConnected(),
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    /**
     * Setup event handlers for MongoDB connection
     */
    setupEventHandlers() {
        const db = mongoose.connection;

        db.on('error', (error) => {
            console.error('MongoDB connection error:', error);
            this.isConnected = false;
        });

        db.on('disconnected', () => {
            console.log('MongoDB disconnected');
            this.isConnected = false;
        });

        db.on('reconnected', () => {
            console.log('MongoDB reconnected');
            this.isConnected = true;
        });

        // Handle process termination
        process.on('SIGINT', async () => {
            await this.disconnect();
            process.exit(0);
        });
    }

    /**
     * Create indexes (Laravel migration equivalent)
     */
    async createIndexes() {
        try {
            const IdentityDocument = require('../app/Models/IdentityDocument');

            // Create indexes for performance
            await IdentityDocument.createIndexes();

            console.log('✅ MongoDB indexes created successfully');
        } catch (error) {
            console.error('❌ Failed to create MongoDB indexes:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        try {
            if (!this.isDbConnected()) {
                throw new Error('Database not connected');
            }

            const admin = mongoose.connection.db.admin();
            const stats = await admin.serverStatus();

            return {
                version: stats.version,
                connections: stats.connections,
                memory: stats.mem,
                network: stats.network
            };

        } catch (error) {
            console.error('Error getting database stats:', error);
            return null;
        }
    }

    /**
     * Clear all collections (for testing)
     */
    async clearDatabase() {
        if (process.env.NODE_ENV !== 'testing') {
            throw new Error('clearDatabase can only be used in testing environment');
        }

        try {
            const collections = await mongoose.connection.db.collections();

            for (const collection of collections) {
                await collection.deleteMany({});
            }

            console.log('✅ Test database cleared');
        } catch (error) {
            console.error('Error clearing database:', error);
            throw error;
        }
    }
}

// Create and export singleton instance
const database = new DatabaseConnection();

module.exports = database;