import { Octokit } from '@octokit/rest';
import LLMSpecDetector, { type LLMSpecAnalysis } from './llmSpecDetector.js';

interface SpecInfo {
  filePath: string;
  apiName: string;
  version?: string;
  content?: any;
  size?: number;
  downloadUrl?: string;
  confidence?: number;
  specType?: string;
}

interface ComparisonReport {
  patternMatchingResults: SpecInfo[];
  llmDetectionResults: SpecInfo[];
  improvementMetrics: {
    additionalSpecsFound: number;
    falsePositivesReduced: number;
    processingTimeComparison: number;
  };
}

export class RepositoryScanner {
  private readonly octokit: Octokit;
  private readonly llmDetector: LLMSpecDetector;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.llmDetector = new LLMSpecDetector();
  }

  /**
   * NEW: Smart two-stage detection using LLM
   * Replaces the expensive 42+ path pattern-matching system
   */
  async scanRepositoryForSpecs(owner: string, repo: string, ref = 'HEAD'): Promise<SpecInfo[]> {
    try {
      console.log(`🔍 Starting LLM-based repository scan for ${owner}/${repo}`);
      const startTime = Date.now();

      // Stage 1: Fast file filtering (YAML/JSON only)
      const candidateFiles = await this.getCandidateFiles(owner, repo, ref);
      console.log(`📁 Found ${candidateFiles.length} YAML/JSON candidate files`);

      if (candidateFiles.length === 0) {
        console.log(`📭 No YAML/JSON files found in ${owner}/${repo}`);
        return [];
      }

      // Stage 2: LLM content analysis (batch process)
      const llmAnalysis = await this.llmDetector.batchAnalyzeFiles(candidateFiles);

      // Stage 3: Process confirmed specs
      const confirmedSpecs = llmAnalysis.filter(a => a.confidence >= 7);
      const results = await this.processConfirmedSpecs(owner, repo, confirmedSpecs, candidateFiles);

      const totalTime = Date.now() - startTime;
      console.log(`✅ LLM scan complete for ${owner}/${repo}: ${results.length} specs found in ${totalTime}ms`);

      return results;
    } catch (error: any) {
      console.error(`❌ LLM scan failed for ${owner}/${repo}, falling back to pattern matching:`, error.message);
      return await this.patternBasedDetection(owner, repo, ref);
    }
  }

  /**
   * Stage 1: Get candidate YAML/JSON files (fast GitHub API filtering)
   * Replaces expensive recursive directory traversal
   */
  private async getCandidateFiles(owner: string, repo: string, ref: string): Promise<Array<{path: string, content: string}>> {
    try {
      // Get repository tree (much faster than individual file requests)
      const treeResponse = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: ref,
        recursive: 'true' // Get all files in one request
      });

      // Filter for YAML/JSON files only
      const yamlJsonFiles = treeResponse.data.tree.filter(item => 
        item.type === 'blob' && 
        item.path && 
        (item.path.endsWith('.yaml') || 
         item.path.endsWith('.yml') || 
         item.path.endsWith('.json')) &&
        (item.size || 0) > 100 && // Skip tiny files
        (item.size || 0) < 100000 // Skip huge files (>100KB)
      );

      console.log(`📋 Filtered to ${yamlJsonFiles.length} YAML/JSON files for LLM analysis`);

      // Fetch content for candidate files (batch efficiently)
      const candidateFiles = [];
      for (const file of yamlJsonFiles.slice(0, 50)) { // Limit to 50 files for cost control
        try {
          const fileResponse = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path!,
            ref
          });

          if (!Array.isArray(fileResponse.data) && fileResponse.data.type === 'file') {
            const content = Buffer.from(fileResponse.data.content, 'base64').toString();
            candidateFiles.push({
              path: file.path!,
              content: content
            });
          }
        } catch (error: any) {
          console.log(`⚠️ Could not fetch ${file.path}: ${error.message}`);
        }
      }

      return candidateFiles;
    } catch (error: any) {
      console.error(`❌ Error getting candidate files:`, error.message);
      return [];
    }
  }

  /**
   * Stage 3: Process confirmed API specs from LLM analysis
   */
  private async processConfirmedSpecs(
    owner: string, 
    repo: string, 
    confirmedSpecs: LLMSpecAnalysis[], 
    candidateFiles: Array<{path: string, content: string}>
  ): Promise<SpecInfo[]> {
    const results: SpecInfo[] = [];

    for (let i = 0; i < confirmedSpecs.length; i++) {
      const analysis = confirmedSpecs[i];
      const candidateFile = candidateFiles[i];
      
      if (!analysis.isApiSpec || analysis.confidence < 7) {
        continue;
      }

      try {
        // Parse the spec content to extract metadata
        const parsedContent = this.parseSpecContent(candidateFile.content, candidateFile.path);
        
        const specInfo: SpecInfo = {
          filePath: candidateFile.path,
          apiName: parsedContent?.info?.title || `API from ${candidateFile.path}`,
          version: parsedContent?.info?.version,
          content: parsedContent,
          confidence: analysis.confidence,
          specType: analysis.specType
        };

        results.push(specInfo);
        console.log(`✅ Confirmed API spec: ${specInfo.filePath} - ${specInfo.apiName} (confidence: ${analysis.confidence}/10)`);
      } catch (error: any) {
        console.warn(`⚠️ Could not parse confirmed spec ${candidateFile.path}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Parse spec content to extract API metadata
   */
  private parseSpecContent(content: string, filePath: string): any {
    try {
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      } else {
        // For YAML files, try JSON parse first (some YAML is also valid JSON)
        try {
          return JSON.parse(content);
        } catch {
          // Would use proper YAML parser in production
          return { info: { title: 'YAML API Spec', version: 'unknown' } };
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse spec content: ${error}`);
    }
  }

  /**
   * Fallback to pattern-based detection (simplified version of old system)
   */
  private async patternBasedDetection(owner: string, repo: string, ref: string): Promise<SpecInfo[]> {
    console.log(`🔄 Using pattern-based fallback detection for ${owner}/${repo}`);
    
    const commonPaths = [
      'openapi.yaml',
      'openapi.yml', 
      'swagger.yaml',
      'swagger.yml',
      'api.yaml',
      'api.yml'
    ];

    const results: SpecInfo[] = [];

    for (const path of commonPaths) {
      try {
        const fileResponse = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref
        });

        if (!Array.isArray(fileResponse.data) && fileResponse.data.type === 'file') {
          const content = Buffer.from(fileResponse.data.content, 'base64').toString();
          const parsedContent = this.parseSpecContent(content, path);
          
          if (this.isValidOpenAPISpec(parsedContent)) {
            results.push({
              filePath: path,
              apiName: parsedContent?.info?.title || 'API Specification',
              version: parsedContent?.info?.version,
              content: parsedContent
            });
          }
        }
      } catch (error: any) {
        // Path not found, continue
      }
    }

    console.log(`🔄 Pattern-based fallback found ${results.length} specs`);
    return results;
  }

  /**
   * Basic OpenAPI spec validation (fallback method)
   */
  private isValidOpenAPISpec(content: any): boolean {
    if (!content || typeof content !== 'object') return false;
    
    return !!(
      (content.openapi && content.info && content.paths) || // OpenAPI 3.x
      (content.swagger && content.info && content.paths)    // Swagger 2.x
    );
  }

  /**
   * Main entry point with fallback strategy
   */
  async detectSpecsWithFallback(owner: string, repo: string): Promise<SpecInfo[]> {
    try {
      // Try LLM detection first
      if (process.env.LLM_ENABLED !== 'false') {
        return await this.scanRepositoryForSpecs(owner, repo);
      }
    } catch (error) {
      console.warn('LLM detection failed, falling back to pattern matching', { error });
    }
    
    // Fallback to pattern-based system
    return await this.patternBasedDetection(owner, repo, 'HEAD');
  }

  /**
   * Compare detection methods for testing
   */
  async compareDetectionMethods(owner: string, repo: string): Promise<ComparisonReport> {
    console.log(`📊 Comparing detection methods for ${owner}/${repo}`);
    
    const startTime = Date.now();
    const [llmResults, patternResults] = await Promise.all([
      this.scanRepositoryForSpecs(owner, repo),
      this.patternBasedDetection(owner, repo, 'HEAD')
    ]);
    const totalTime = Date.now() - startTime;

    return {
      patternMatchingResults: patternResults,
      llmDetectionResults: llmResults,
      improvementMetrics: {
        additionalSpecsFound: llmResults.length - patternResults.length,
        falsePositivesReduced: 0, // Would need manual verification
        processingTimeComparison: totalTime
      }
    };
  }
}

export default RepositoryScanner;