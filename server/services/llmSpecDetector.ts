import OpenAI from "openai";
import crypto from "crypto";

export interface LLMSpecAnalysis {
  isApiSpec: boolean;
  specType: 'openapi-3.x' | 'swagger-2.x' | 'asyncapi' | 'graphql' | 'unknown';
  confidence: number; // 1-10
  reasoning: string;
  endpoints?: number; // estimated endpoint count
}

interface LLMDetectionMetrics {
  totalFilesAnalyzed: number;
  specsDetected: number;
  averageConfidence: number;
  costPerDetection: number;
  processingTime: number;
  fallbackUsage: number;
}

class LLMCostController {
  private dailyUsage = 0;
  private cache = new Map<string, LLMSpecAnalysis>();
  private readonly dailyBudget: number;
  private readonly cacheTTL: number;

  constructor() {
    this.dailyBudget = parseFloat(process.env.LLM_DAILY_BUDGET || '10.00');
    this.cacheTTL = parseInt(process.env.LLM_CACHE_TTL || '86400') * 1000; // Convert to ms
  }

  async checkBudget(): Promise<boolean> {
    return this.dailyUsage < this.dailyBudget;
  }

  async trackUsage(cost: number): Promise<void> {
    this.dailyUsage += cost;
  }

  async getCachedResult(fileHash: string): Promise<LLMSpecAnalysis | null> {
    return this.cache.get(fileHash) || null;
  }

  async setCachedResult(fileHash: string, result: LLMSpecAnalysis): Promise<void> {
    this.cache.set(fileHash, result);
    // Simple TTL cleanup - in production would use Redis or similar
    setTimeout(() => {
      this.cache.delete(fileHash);
    }, this.cacheTTL);
  }
}

export class LLMSpecDetector {
  private readonly openai: OpenAI;
  private readonly maxContentLength = 3000; // Cost control
  private readonly confidenceThreshold = 7;
  private readonly costController: LLMCostController;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.costController = new LLMCostController();
    this.model = process.env.LLM_MODEL || 'gpt-4o-mini';
    this.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || '1000');
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '10000');
  }

  private buildAnalysisPrompt(filePath: string, content: string): string {
    return `Analyze this file to determine if it contains API specifications.

FILEPATH: ${filePath}
CONTENT (first 3000 chars):
${content.substring(0, this.maxContentLength)}

Return ONLY valid JSON with this exact structure:
{
  "isApiSpec": boolean,
  "specType": "openapi-3.x" | "swagger-2.x" | "asyncapi" | "graphql" | "unknown",
  "confidence": number (1-10),
  "reasoning": "brief explanation",
  "endpoints": number (estimated count of endpoints/operations)
}

CRITERIA:
- Look for: openapi, swagger, paths, operations, endpoints, schemas, definitions
- Ignore: configuration files, documentation, examples
- Consider: file structure, keywords, content patterns
- Confidence 8+: Definitely an API spec
- Confidence 5-7: Possibly an API spec  
- Confidence <5: Probably not an API spec

RESPOND WITH ONLY THE JSON OBJECT.`;
  }

  private generateFileHash(filePath: string, content: string): string {
    return crypto.createHash('md5').update(`${filePath}:${content}`).digest('hex');
  }

  async analyzeFile(filePath: string, content: string): Promise<LLMSpecAnalysis> {
    const fileHash = this.generateFileHash(filePath, content);
    
    // Check cache first
    const cachedResult = await this.costController.getCachedResult(fileHash);
    if (cachedResult) {
      console.log(`📋 Cache hit for ${filePath}`);
      return cachedResult;
    }

    // Check budget
    if (!(await this.costController.checkBudget())) {
      console.warn(`💰 Daily LLM budget exceeded, falling back to pattern matching`);
      throw new Error('Daily LLM budget exceeded');
    }

    try {
      const prompt = this.buildAnalysisPrompt(filePath, content);
      
      console.log(`🤖 LLM analyzing: ${filePath}`);
      const startTime = Date.now();

      const response = await this.openai.chat.completions.create({
        model: this.model, // gpt-4o-mini for cost effectiveness
        messages: [
          {
            role: "system",
            content: "You are an expert at identifying API specifications. Respond only with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.1, // Low temperature for consistent results
        response_format: { type: "json_object" }
      });

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ LLM analysis completed in ${processingTime}ms`);

      const result = JSON.parse(response.choices[0].message.content || '{}') as LLMSpecAnalysis;
      
      // Estimate cost (rough calculation for gpt-4o-mini)
      const estimatedCost = (response.usage?.total_tokens || 0) * 0.000001; // ~$0.001/1K tokens
      await this.costController.trackUsage(estimatedCost);

      // Cache result
      await this.costController.setCachedResult(fileHash, result);

      console.log(`🎯 Analysis result for ${filePath}: ${result.isApiSpec ? '✅ API SPEC' : '❌ NOT SPEC'} (confidence: ${result.confidence}/10)`);

      return result;
    } catch (error: any) {
      console.error(`❌ LLM analysis failed for ${filePath}:`, error.message);
      throw error;
    }
  }

  async batchAnalyzeFiles(files: Array<{path: string, content: string}>): Promise<LLMSpecAnalysis[]> {
    const batchSize = 10; // Process in batches to control API usage
    const batches = this.chunkArray(files, batchSize);
    const results: LLMSpecAnalysis[] = [];

    console.log(`📊 Starting batch analysis of ${files.length} files in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);

      try {
        const batchResults = await Promise.allSettled(
          batch.map(file => this.analyzeFile(file.path, file.content))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.warn(`⚠️ Batch analysis failed for file:`, result.reason);
            // Add fallback result for failed analysis
            results.push({
              isApiSpec: false,
              specType: 'unknown',
              confidence: 0,
              reasoning: 'LLM analysis failed',
              endpoints: 0
            });
          }
        }

        // Rate limiting between batches
        if (i < batches.length - 1) {
          console.log(`⏳ Rate limiting: waiting 1 second before next batch...`);
          await this.sleep(1000);
        }
      } catch (error) {
        console.error(`❌ Batch processing failed:`, error);
        throw error;
      }
    }

    const detectedSpecs = results.filter(r => r.isApiSpec && r.confidence >= this.confidenceThreshold);
    console.log(`🎯 Batch analysis complete: ${detectedSpecs.length}/${results.length} API specs detected`);

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get metrics for monitoring
  getMetrics(): LLMDetectionMetrics {
    return {
      totalFilesAnalyzed: 0, // Would track in production
      specsDetected: 0,
      averageConfidence: 0,
      costPerDetection: 0,
      processingTime: 0,
      fallbackUsage: 0
    };
  }
}

export default LLMSpecDetector;