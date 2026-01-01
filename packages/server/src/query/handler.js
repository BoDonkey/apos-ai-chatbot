/**
 * @fileoverview Query handler using LangChain and Weaviate
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { 
  createHistoryAwareRetriever,
  createStuffDocumentsChain
} from 'langchain/chains';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { CONSTANTS, createLogger } from '@apos-chatbot/shared';
import { detectIntent, isApostropheRelated } from './intent-detector.js';

const logger = createLogger('QueryHandler');

// Store for conversation histories
/** @type {Map<string, ChatMessageHistory>} */
const conversationHistories = new Map();

/**
 * Get or create conversation history for a session
 * @param {string} sessionId
 * @returns {ChatMessageHistory}
 */
function getSessionHistory(sessionId) {
  if (!conversationHistories.has(sessionId)) {
    conversationHistories.set(sessionId, new ChatMessageHistory());
  }
  return conversationHistories.get(sessionId);
}

/**
 * Query handler class
 */
export class QueryHandler {
  /**
   * @param {Object} weaviateRetriever - Weaviate retriever instance
   */
  constructor(weaviateRetriever) {
    this.retriever = weaviateRetriever;
    this.currentModel = null;
    this.setupChain();
  }

  /**
   * Setup the LangChain conversational chain
   */
  setupChain() {
    // Initialize LLM based on environment
    const modelChoice = process.env.CHAT_MODEL || 'ChatOpenAI';
    
    if (modelChoice === 'ChatOpenAI') {
      this.llm = new ChatOpenAI({
        temperature: 0,
        modelName: 'gpt-4o'
      });
      this.currentModel = 'gpt-4o';
    } else {
      this.llm = new ChatAnthropic({
        temperature: 0.0,
        modelName: 'claude-3-5-sonnet-20240620'
      });
      this.currentModel = 'claude-3-5-sonnet-20240620';
    }

    logger.info(`Initialized with model: ${this.currentModel}`);
  }

  /**
   * Process a user query
   * @param {string} query - User's question
   * @param {import('@apos-chatbot/shared').QueryContext} context - Query context
   * @returns {Promise<import('@apos-chatbot/shared').ChatbotResponse>}
   */
  async processQuery(query, context) {
    const startTime = Date.now();
    
    // Check if query is ApostropheCMS-related
    if (!isApostropheRelated(query)) {
      return {
        answer: CONSTANTS.RESPONSES.OUT_OF_SCOPE,
        sources: [],
        intent: { type: 'general', confidence: 0, frameworks: [] },
        confidence: 0,
        metadata: {
          model: this.currentModel,
          processingTime: Date.now() - startTime
        }
      };
    }
    
    // Detect intent
    const intent = detectIntent(query);
    logger.info('Query intent', { intent, sessionId: context.sessionId });
    
    // Build Weaviate filter based on intent
    const filter = this.buildWeaviateFilter(intent);
    
    // Retrieve relevant documents
    const retrievedDocs = await this.retriever.invoke(query, {
      filter
    });
    
    if (!retrievedDocs || retrievedDocs.length === 0) {
      return {
        answer: CONSTANTS.RESPONSES.EMPTY_KNOWLEDGE_BASE,
        sources: [],
        intent,
        confidence: 0,
        metadata: {
          model: this.currentModel,
          processingTime: Date.now() - startTime
        }
      };
    }
    
    // Calculate confidence based on relevance scores
    const confidence = this.calculateConfidence(retrievedDocs);
    
    if (confidence < CONSTANTS.CONFIDENCE.LOW) {
      return {
        answer: CONSTANTS.RESPONSES.LOW_CONFIDENCE,
        sources: retrievedDocs.map(doc => ({
          content: doc.pageContent,
          url: doc.metadata.url,
          title: doc.metadata.title,
          distance: 0,
          certainty: 0
        })),
        intent,
        confidence,
        metadata: {
          model: this.currentModel,
          processingTime: Date.now() - startTime
        }
      };
    }
    
    // Create the conversational chain
    const chain = await this.createConversationalChain();
    
    // Get response from LLM
    const response = await chain.invoke(
      { input: query },
      { 
        configurable: { sessionId: context.sessionId },
        callbacks: [
          {
            handleLLMEnd: (output) => {
              logger.debug('LLM response generated', {
                sessionId: context.sessionId
              });
            }
          }
        ]
      }
    );
    
    return {
      answer: response.answer,
      sources: retrievedDocs.map(doc => ({
        content: doc.pageContent,
        url: doc.metadata.url || 'https://docs.apostrophecms.org',
        title: doc.metadata.title || 'ApostropheCMS Documentation',
        distance: 0,
        certainty: 1
      })),
      intent,
      confidence,
      metadata: {
        model: this.currentModel,
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Build Weaviate filter based on intent
   * @param {import('@apos-chatbot/shared').QueryIntent} intent
   * @returns {Object|null}
   */
  buildWeaviateFilter(intent) {
    // For Astro queries, prioritize Astro content
    if (intent.suggestedFilters?.prioritizeAstro) {
      return {
        path: ['framework'],
        operator: 'Equal',
        valueText: 'astro'
      };
    }
    
    // Filter by version if specified
    if (intent.suggestedFilters?.version) {
      return {
        path: ['version'],
        operator: 'Equal',
        valueText: intent.suggestedFilters.version
      };
    }
    
    return null;
  }

  /**
   * Calculate confidence score from retrieved documents
   * @param {Array} docs
   * @returns {number}
   */
  calculateConfidence(docs) {
    if (!docs || docs.length === 0) return 0;
    
    // Simple heuristic: more docs = higher confidence
    // In production, you'd use the actual certainty scores from Weaviate
    const baseConfidence = Math.min(0.9, 0.5 + (docs.length * 0.1));
    return baseConfidence;
  }

  /**
   * Create conversational RAG chain
   * @returns {Promise<RunnableWithMessageHistory>}
   */
  async createConversationalChain() {
    // Contextualize question prompt
    const contextualizePrompt = ChatPromptTemplate.fromMessages([
      ['system', `Given a chat history and the latest user question which might reference context in the chat history, formulate a standalone question which can be understood without the chat history. Match the language of the question or chat history. Do NOT answer the question, just reformulate it if needed and otherwise return it as is.`],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ]);

    // Create history-aware retriever
    const historyAwareRetriever = await createHistoryAwareRetriever({
      llm: this.llm,
      retriever: this.retriever,
      rephrasePrompt: contextualizePrompt,
    });

    // System prompt for answering
    const systemPrompt = `You are a senior developer with extensive expertise in Node.js, Express.js, Nunjucks, Vue.js, Astro, and the ApostropheCMS ecosystem (version 3 and above). Your main responsibility is to assist junior developers by providing insightful answers to their questions about developing within the ApostropheCMS framework.

Key Guidelines:
1. Relevance: Only respond to inquiries that pertain to developing for ApostropheCMS. If a question falls outside this domain, kindly inform the user that it is beyond the scope of your expertise.
2. Conciseness: Be as concise as possible. Users should primarily be directed to the ApostropheCMS documentation for detailed information.
3. Documentation Links: Provide the top 2-3 unique links to relevant ApostropheCMS documentation from the sources.
4. ESM Syntax: ALWAYS use ESM syntax by default, unless the user specifically asks for CommonJS (CJS) syntax.
5. Version: Ensure your responses are applicable to ApostropheCMS version 3 and newer (preferably 4.x).
6. Code Examples: Incorporate code examples only if needed. Focus on clarity and conciseness.
7. Astro Integration: When questions relate to Astro, prioritize Astro-specific integration patterns and best practices.
8. Code Highlighting:
   - JavaScript/Node.js: \`\`\`javascript
   - Nunjucks templates: \`\`\`twig
   - Astro components: \`\`\`javascript
   - Vue components: \`\`\`javascript
   - HTML: \`\`\`html
   - CSS: \`\`\`css
   - Shell/Bash: \`\`\`bash

Answer in English by default, but respond in the user's language if they ask in another language.

Context:
{context}`;

    const qaPrompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ]);

    // Create stuff documents chain
    const questionAnswerChain = await createStuffDocumentsChain({
      llm: this.llm,
      prompt: qaPrompt,
    });

    // Create retrieval chain (simplified - you may need to adjust based on your LangChain version)
    const chain = questionAnswerChain;

    // Wrap with message history
    const conversationalChain = new RunnableWithMessageHistory({
      runnable: chain,
      getMessageHistory: getSessionHistory,
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
      outputMessagesKey: 'answer',
    });

    return conversationalChain;
  }

  /**
   * Get current model name
   * @returns {string}
   */
  getModelName() {
    return this.currentModel;
  }
}
