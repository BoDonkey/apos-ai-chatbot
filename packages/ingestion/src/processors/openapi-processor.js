/**
 * @fileoverview OpenAPI specification processor for ingestion
 * Processes OpenAPI 3.x spec files into Weaviate documents
 */

import { readFile } from 'fs/promises';
import yaml from 'js-yaml';
import { createLogger } from '@apos-chatbot/shared';

const logger = createLogger('OpenAPIProcessor');

/**
 * Fetch and process OpenAPI spec
 * @param {string} source - File path or URL to OpenAPI spec
 * @returns {Promise<import('@apos-chatbot/shared').ScrapedPage[]>}
 */
export async function processOpenAPISpec(source) {
  logger.info(`Processing OpenAPI spec from: ${source}`);

  let specContent;
  
  // Fetch from URL or read from file
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
    }
    specContent = await response.text();
  } else {
    specContent = await readFile(source, 'utf-8');
  }

  // Parse JSON or YAML
  let spec;
  try {
    // Try JSON first
    spec = JSON.parse(specContent);
  } catch (jsonError) {
    // If JSON fails, try YAML
    try {
      spec = yaml.load(specContent);
      logger.info('Successfully parsed YAML spec');
    } catch (yamlError) {
      logger.error('Failed to parse spec as JSON or YAML', { jsonError, yamlError });
      throw new Error('OpenAPI spec must be valid JSON or YAML');
    }
  }

  logger.info(`Parsed OpenAPI spec: ${spec.info?.title || 'Unknown'} v${spec.info?.version || 'Unknown'}`);

  // Extract documentation pages
  const pages = [];

  // 1. Overview page from spec info
  if (spec.info) {
    pages.push(createInfoPage(spec.info, source));
  }

  // 2. Pages for each endpoint/operation
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip non-operation keys like $ref, servers, parameters
        if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
          continue;
        }

        pages.push(createOperationPage(path, method, operation, spec, source));
      }
    }
  }

  // 3. Pages for schemas/components (if significant)
  if (spec.components?.schemas) {
    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      pages.push(createSchemaPage(schemaName, schema, source));
    }
  }

  logger.info(`Created ${pages.length} documentation pages from OpenAPI spec`);
  return pages;
}

/**
 * Create overview page from OpenAPI info
 * @param {Object} info - OpenAPI info object
 * @param {string} source - Source URL/path
 * @returns {import('@apos-chatbot/shared').ScrapedPage}
 */
function createInfoPage(info, source) {
  const content = `
# ${info.title || 'API Documentation'}

**Version:** ${info.version || 'Unknown'}

${info.description || ''}

${info.termsOfService ? `**Terms of Service:** ${info.termsOfService}` : ''}

${info.contact ? `
## Contact
${info.contact.name ? `- Name: ${info.contact.name}` : ''}
${info.contact.email ? `- Email: ${info.contact.email}` : ''}
${info.contact.url ? `- URL: ${info.contact.url}` : ''}
` : ''}

${info.license ? `
## License
${info.license.name ? `- ${info.license.name}` : ''}
${info.license.url ? `- ${info.license.url}` : ''}
` : ''}
`.trim();

  return {
    url: `${source}#info`,
    title: `${info.title || 'API'} - Overview`,
    content,
    links: [],
    metadata: {
      description: info.description || '',
      headings: ['Overview', 'Contact', 'License'].filter(Boolean),
      scrapedAt: new Date()
    }
  };
}

/**
 * Create page for an API operation
 * @param {string} path - API path
 * @param {string} method - HTTP method
 * @param {Object} operation - OpenAPI operation object
 * @param {Object} spec - Full OpenAPI spec
 * @param {string} source - Source URL/path
 * @returns {import('@apos-chatbot/shared').ScrapedPage}
 */
function createOperationPage(path, method, operation, spec, source) {
  const title = operation.summary || `${method.toUpperCase()} ${path}`;
  
  let content = `# ${title}

**Endpoint:** \`${method.toUpperCase()} ${path}\`

${operation.description || ''}

${operation.deprecated ? '**⚠️ This endpoint is deprecated.**' : ''}

${operation.tags ? `**Tags:** ${operation.tags.join(', ')}` : ''}
`;

  // Parameters
  if (operation.parameters && operation.parameters.length > 0) {
    content += '\n## Parameters\n\n';
    for (const param of operation.parameters) {
      const required = param.required ? ' (required)' : ' (optional)';
      content += `- **${param.name}**${required} (${param.in}): ${param.description || 'No description'}\n`;
      
      if (param.schema) {
        content += `  - Type: \`${param.schema.type || 'any'}\`\n`;
        if (param.schema.enum) {
          content += `  - Allowed values: ${param.schema.enum.join(', ')}\n`;
        }
      }
    }
  }

  // Request body
  if (operation.requestBody) {
    content += '\n## Request Body\n\n';
    content += operation.requestBody.description || '';
    
    if (operation.requestBody.content) {
      for (const [mediaType, mediaTypeObj] of Object.entries(operation.requestBody.content)) {
        content += `\n\n**Content-Type:** \`${mediaType}\`\n`;
        if (mediaTypeObj.schema) {
          content += formatSchema(mediaTypeObj.schema, spec);
        }
      }
    }
  }

  // Responses
  if (operation.responses) {
    content += '\n## Responses\n\n';
    for (const [statusCode, response] of Object.entries(operation.responses)) {
      content += `### ${statusCode}\n\n`;
      content += response.description || 'No description';
      
      if (response.content) {
        for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
          content += `\n\n**Content-Type:** \`${mediaType}\`\n`;
          if (mediaTypeObj.schema) {
            content += formatSchema(mediaTypeObj.schema, spec);
          }
        }
      }
      content += '\n\n';
    }
  }

  return {
    url: `${source}#${method}-${path.replace(/\//g, '-')}`,
    title,
    content: content.trim(),
    links: [],
    metadata: {
      description: operation.description || operation.summary || '',
      headings: ['Parameters', 'Request Body', 'Responses'].filter(Boolean),
      scrapedAt: new Date()
    }
  };
}

/**
 * Create page for a schema definition
 * @param {string} schemaName - Schema name
 * @param {Object} schema - OpenAPI schema object
 * @param {string} source - Source URL/path
 * @returns {import('@apos-chatbot/shared').ScrapedPage}
 */
function createSchemaPage(schemaName, schema, source) {
  let content = `# Schema: ${schemaName}

${schema.description || ''}

${schema.type ? `**Type:** \`${schema.type}\`` : ''}
`;

  if (schema.properties) {
    content += '\n## Properties\n\n';
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(propName) ? ' (required)' : ' (optional)';
      content += `- **${propName}**${required}: ${propSchema.description || 'No description'}\n`;
      content += `  - Type: \`${propSchema.type || 'any'}\`\n`;
      
      if (propSchema.enum) {
        content += `  - Allowed values: ${propSchema.enum.join(', ')}\n`;
      }
      if (propSchema.format) {
        content += `  - Format: \`${propSchema.format}\`\n`;
      }
    }
  }

  if (schema.enum) {
    content += `\n## Allowed Values\n\n${schema.enum.join(', ')}`;
  }

  return {
    url: `${source}#schema-${schemaName}`,
    title: `Schema: ${schemaName}`,
    content: content.trim(),
    links: [],
    metadata: {
      description: schema.description || '',
      headings: ['Properties', 'Allowed Values'].filter(Boolean),
      scrapedAt: new Date()
    }
  };
}

/**
 * Format schema for display
 * @param {Object} schema - OpenAPI schema object
 * @param {Object} spec - Full spec for resolving $refs
 * @returns {string}
 */
function formatSchema(schema, spec) {
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    const refSchema = refPath.reduce((obj, key) => obj[key], spec);
    return formatSchema(refSchema, spec);
  }

  let output = '';
  
  if (schema.type) {
    output += `Type: \`${schema.type}\`\n`;
  }

  if (schema.properties) {
    output += '\nProperties:\n';
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      output += `- \`${propName}\` (${propSchema.type || 'any'}): ${propSchema.description || ''}\n`;
    }
  }

  if (schema.items) {
    output += '\nArray items:\n';
    output += formatSchema(schema.items, spec);
  }

  return output;
}
