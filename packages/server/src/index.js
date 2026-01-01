/**
 * @fileoverview Main server entry point
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { MongoClient } from 'mongodb';
import weaviate from 'weaviate-ts-client';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';
import { stringify } from 'csv-stringify/sync';
import { requireEnv, getBoolEnv, getNumberEnv, createLogger, APOS_DOCS_SCHEMA } from '@apos-chatbot/shared';
import { QueryHandler } from './query/handler.js';

dotenv.config();

const logger = createLogger('Server');

// Environment variables
const PORT = getNumberEnv('PORT', 3000);
const WEAVIATE_URL = requireEnv('WEAVIATE_URL');
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY;
const MONGODB_URI = requireEnv('APOS_MONGODB_URI');
const MONGO_DB_NAME = process.env.MONGO_CONVERSATION_DB || 'ai_conversations';
const FILE_PASSWORD = process.env.FILE_PASSWORD;
const SLACK_HOOK = process.env.SLACK_HOOK;
const LOG_TO_SLACK = getBoolEnv('LOG_TO_SLACK', false);

// Initialize Express and Socket.IO
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Rate limiter
const limiter = rateLimit({
  windowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', 60000),
  max: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 2),
  standardHeaders: true,
  legacyHeaders: false,
});

// Global state
let mongoClient;
let conversationCollection;
let weaviateClient;
let weaviateRetriever;
let queryHandler;

// Session storage
const sessions = new Map();

/**
 * Initialize MongoDB connection
 */
async function initMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    logger.info('Connected to MongoDB');
    
    const db = mongoClient.db(MONGO_DB_NAME);
    conversationCollection = db.collection('conversations');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

/**
 * Initialize Weaviate client and retriever
 */
async function initWeaviate() {
  try {
    const clientConfig = {
      scheme: WEAVIATE_URL.startsWith('https') ? 'https' : 'http',
      host: WEAVIATE_URL.replace(/^https?:\/\//, ''),
    };

    if (WEAVIATE_API_KEY) {
      clientConfig.apiKey = new weaviate.ApiKey(WEAVIATE_API_KEY);
    }

    weaviateClient = weaviate.client(clientConfig);

    // Test connection
    const meta = await weaviateClient.misc.metaGetter().do();
    logger.info('Connected to Weaviate', { version: meta.version });

    // Create a simple retriever
    // In production, you'd use LangChain's Weaviate integration
    weaviateRetriever = {
      async invoke(query, options = {}) {
        try {
          let queryBuilder = weaviateClient.graphql
            .get()
            .withClassName(APOS_DOCS_SCHEMA.class)
            .withNearText({ concepts: [query] })
            .withLimit(6)
            .withFields('content title url version framework docType _additional { distance certainty }');

          // Apply filters if provided
          if (options.filter) {
            queryBuilder = queryBuilder.withWhere(options.filter);
          }

          const result = await queryBuilder.do();

          if (!result.data?.Get?.[APOS_DOCS_SCHEMA.class]) {
            return [];
          }

          return result.data.Get[APOS_DOCS_SCHEMA.class].map(doc => ({
            pageContent: doc.content,
            metadata: {
              title: doc.title,
              url: doc.url,
              version: doc.version,
              framework: doc.framework,
              docType: doc.docType,
              distance: doc._additional.distance,
              certainty: doc._additional.certainty
            }
          }));
        } catch (error) {
          logger.error('Weaviate retrieval failed', error);
          return [];
        }
      }
    };

    logger.info('Weaviate retriever initialized');
  } catch (error) {
    logger.error('Failed to initialize Weaviate', error);
    throw error;
  }
}

/**
 * Log to Slack
 */
async function logToSlack(sessionId, question, answer, modelName) {
  if (!LOG_TO_SLACK || !SLACK_HOOK) {
    logger.debug('Slack logging disabled');
    return;
  }

  try {
    const payload = {
      text: `User session ID: ${sessionId}\nTime: ${new Date().toISOString()}\nModel: ${modelName}\nQuestion: ${question}\nAnswer: ${answer}`
    };

    const response = await fetch(SLACK_HOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack returned ${response.status}`);
    }
  } catch (error) {
    logger.error('Failed to log to Slack', error);
  }
}

/**
 * Log to MongoDB
 */
async function logToMongo(sessionId, question, answer, modelName, source = 'web') {
  if (!conversationCollection) return;

  try {
    await conversationCollection.insertOne({
      session_id: sessionId,
      query: question,
      answer: answer,
      model: modelName,
      source: source,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Failed to log to MongoDB', error);
  }
}

// Routes
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

app.get('/health', async (req, res) => {
  try {
    const mongoHealthy = mongoClient ? await mongoClient.db().admin().ping() : false;
    const weaviateHealthy = weaviateClient ? await weaviateClient.misc.metaGetter().do() : false;

    res.json({
      status: 'ok',
      mongo: !!mongoHealthy,
      weaviate: !!weaviateHealthy
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/export_conversations', async (req, res) => {
  const password = req.query.password;
  
  if (password !== FILE_PASSWORD) {
    return res.status(403).send('Forbidden');
  }

  if (!conversationCollection) {
    return res.status(500).send('MongoDB not connected');
  }

  try {
    const conversations = await conversationCollection.find({}).toArray();
    
    const csvString = stringify(conversations.map(conv => ({
      session_id: conv.session_id || '',
      query: conv.query || '',
      answer: conv.answer || '',
      model: conv.model || '',
      source: conv.source || 'web',
      timestamp: conv.timestamp ? conv.timestamp.toISOString() : ''
    })), {
      header: true
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=conversations.csv');
    res.send(csvString);
  } catch (error) {
    logger.error('Failed to export conversations', error);
    res.status(500).send('Export failed');
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  let userSessionId = socket.handshake.query.user_session_id;
  
  if (!userSessionId) {
    userSessionId = uuidv4();
  }
  
  sessions.set(socket.id, {
    userSessionId,
    requestInProgress: false
  });
  
  socket.emit('session_id', { user_session_id: userSessionId });
  logger.info('Client connected', { sessionId: userSessionId });

  socket.on('query', limiter, async (data) => {
    const session = sessions.get(socket.id);
    
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }
    
    if (session.requestInProgress) {
      socket.emit('error', { message: 'Please wait for the current response.' });
      return;
    }

    session.requestInProgress = true;

    try {
      const query = sanitizeHtml(data.query, {
        allowedTags: [],
        allowedAttributes: {}
      });
      const index = data.index || 0;

      logger.info('Processing query', { 
        sessionId: session.userSessionId, 
        query: query.substring(0, 50) 
      });

      // Process query
      const response = await queryHandler.processQuery(query, {
        sessionId: session.userSessionId,
        source: 'web'
      });

      // Send response
      socket.emit('answer', { 
        text: response.answer, 
        index 
      });

      // Log
      const modelName = queryHandler.getModelName();
      await logToSlack(session.userSessionId, query, response.answer, modelName);
      await logToMongo(session.userSessionId, query, response.answer, modelName);

    } catch (error) {
      logger.error('Query processing failed', error);
      socket.emit('error', { 
        message: 'An error occurred while processing your query.' 
      });
    } finally {
      session.requestInProgress = false;
    }
  });

  socket.on('clear_session', () => {
    sessions.delete(socket.id);
    logger.info('Session cleared', { sessionId: userSessionId });
    socket.disconnect(true);
  });

  socket.on('disconnect', () => {
    sessions.delete(socket.id);
    logger.info('Client disconnected', { sessionId: userSessionId });
  });
});

// Initialize and start server
async function start() {
  try {
    logger.info('Starting server...');
    
    await initMongoDB();
    await initWeaviate();
    
    // Initialize query handler
    queryHandler = new QueryHandler(weaviateRetriever);
    logger.info('Query handler initialized');
    
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (mongoClient) {
    await mongoClient.close();
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

start();

export default app;
