interface BreakingChangeRule {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  impact: string;
  recommendation: string;
}

interface ChangeAnalysisResult {
  breakingChanges: BreakingChange[];
  nonBreakingChanges: NonBreakingChange[];
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface BreakingChange {
  type: string;
  path: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  recommendation: string;
}

interface NonBreakingChange {
  type: string;
  path: string;
  description: string;
}

export class BreakingChangeAnalyzer {
  private rules: Record<string, BreakingChangeRule> = {
    'endpoint_removed': {
      severity: 'critical',
      message: 'API endpoint removed',
      impact: 'Clients calling this endpoint will receive 404 errors',
      recommendation: 'Deprecate endpoint first, then remove after grace period'
    },
    'method_removed': {
      severity: 'critical',
      message: 'HTTP method removed',
      impact: 'Clients using this HTTP method will receive 405 Method Not Allowed errors',
      recommendation: 'Add deprecation warning before removing methods'
    },
    'required_param_added': {
      severity: 'critical',
      message: 'New required parameter added',
      impact: 'Existing clients will send invalid requests missing the required parameter',
      recommendation: 'Make parameter optional with sensible defaults, or version the API'
    },
    'response_field_removed': {
      severity: 'high',
      message: 'Response field removed',
      impact: 'Client code expecting this field may break or behave unexpectedly',
      recommendation: 'Deprecate field first, return null/empty values during transition'
    },
    'field_type_changed': {
      severity: 'high',
      message: 'Field type changed',
      impact: 'Clients may fail to parse responses or send incorrect data types',
      recommendation: 'Use API versioning or introduce new field with different name'
    },
    'enum_value_removed': {
      severity: 'medium',
      message: 'Enum value removed',
      impact: 'Clients sending removed enum values will receive validation errors',
      recommendation: 'Deprecate enum values and handle gracefully in API logic'
    },
    'default_value_changed': {
      severity: 'medium',
      message: 'Default value changed',
      impact: 'Client behavior may change for requests that rely on default values',
      recommendation: 'Document default value changes and consider backwards compatibility'
    },
    'response_format_changed': {
      severity: 'high',
      message: 'Response format changed',
      impact: 'Clients expecting specific response format may fail to parse data',
      recommendation: 'Maintain backward compatibility or use content negotiation'
    },
    'request_body_required': {
      severity: 'critical',
      message: 'Request body now required',
      impact: 'Clients not sending request body will receive validation errors',
      recommendation: 'Make request body optional or provide migration guide'
    },
    'auth_requirements_changed': {
      severity: 'critical',
      message: 'Authentication requirements changed',
      impact: 'Clients may lose access or receive authentication errors',
      recommendation: 'Provide migration path and communicate changes in advance'
    }
  };

  analyzeChanges(comparison: any): ChangeAnalysisResult {
    const breakingChanges: BreakingChange[] = [];
    const nonBreakingChanges: NonBreakingChange[] = [];

    // Analyze paths changes
    this.analyzePaths(comparison, breakingChanges, nonBreakingChanges);
    
    // Analyze schema changes
    this.analyzeSchemas(comparison, breakingChanges, nonBreakingChanges);
    
    // Analyze parameter changes
    this.analyzeParameters(comparison, breakingChanges, nonBreakingChanges);

    // Determine overall severity
    const severity = this.calculateOverallSeverity(breakingChanges);
    
    // Generate summary
    const summary = this.generateSummary(breakingChanges, nonBreakingChanges);

    return {
      breakingChanges,
      nonBreakingChanges,
      summary,
      severity
    };
  }

  private analyzePaths(comparison: any, breakingChanges: BreakingChange[], nonBreakingChanges: NonBreakingChange[]): void {
    // Check for removed paths
    if (comparison.removedPaths) {
      comparison.removedPaths.forEach((path: string) => {
        const rule = this.rules['endpoint_removed'];
        breakingChanges.push({
          type: 'endpoint_removed',
          path,
          description: `Endpoint ${path} was removed`,
          severity: rule.severity,
          impact: rule.impact,
          recommendation: rule.recommendation
        });
      });
    }

    // Check for added paths (non-breaking)
    if (comparison.addedPaths) {
      comparison.addedPaths.forEach((path: string) => {
        nonBreakingChanges.push({
          type: 'endpoint_added',
          path,
          description: `New endpoint ${path} was added`
        });
      });
    }

    // Check for modified paths
    if (comparison.modifiedPaths) {
      comparison.modifiedPaths.forEach((pathChange: any) => {
        this.analyzePathModifications(pathChange, breakingChanges, nonBreakingChanges);
      });
    }
  }

  private analyzePathModifications(pathChange: any, breakingChanges: BreakingChange[], nonBreakingChanges: NonBreakingChange[]): void {
    const path = pathChange.path;

    // Check for removed methods
    if (pathChange.removedMethods) {
      pathChange.removedMethods.forEach((method: string) => {
        const rule = this.rules['method_removed'];
        breakingChanges.push({
          type: 'method_removed',
          path: `${method.toUpperCase()} ${path}`,
          description: `HTTP method ${method.toUpperCase()} was removed from ${path}`,
          severity: rule.severity,
          impact: rule.impact,
          recommendation: rule.recommendation
        });
      });
    }

    // Check for added methods (non-breaking)
    if (pathChange.addedMethods) {
      pathChange.addedMethods.forEach((method: string) => {
        nonBreakingChanges.push({
          type: 'method_added',
          path: `${method.toUpperCase()} ${path}`,
          description: `New HTTP method ${method.toUpperCase()} was added to ${path}`
        });
      });
    }
  }

  private analyzeParameters(comparison: any, breakingChanges: BreakingChange[], nonBreakingChanges: NonBreakingChange[]): void {
    if (comparison.parameterChanges) {
      comparison.parameterChanges.forEach((paramChange: any) => {
        if (paramChange.type === 'required_added') {
          const rule = this.rules['required_param_added'];
          breakingChanges.push({
            type: 'required_param_added',
            path: paramChange.path,
            description: `Required parameter '${paramChange.parameter}' was added`,
            severity: rule.severity,
            impact: rule.impact,
            recommendation: rule.recommendation
          });
        } else if (paramChange.type === 'optional_added') {
          nonBreakingChanges.push({
            type: 'optional_param_added',
            path: paramChange.path,
            description: `Optional parameter '${paramChange.parameter}' was added`
          });
        }
      });
    }
  }

  private analyzeSchemas(comparison: any, breakingChanges: BreakingChange[], nonBreakingChanges: NonBreakingChange[]): void {
    if (comparison.schemaChanges) {
      comparison.schemaChanges.forEach((schemaChange: any) => {
        if (schemaChange.type === 'field_removed') {
          const rule = this.rules['response_field_removed'];
          breakingChanges.push({
            type: 'response_field_removed',
            path: schemaChange.path,
            description: `Field '${schemaChange.field}' was removed from response`,
            severity: rule.severity,
            impact: rule.impact,
            recommendation: rule.recommendation
          });
        } else if (schemaChange.type === 'field_type_changed') {
          const rule = this.rules['field_type_changed'];
          breakingChanges.push({
            type: 'field_type_changed',
            path: schemaChange.path,
            description: `Field '${schemaChange.field}' type changed from ${schemaChange.oldType} to ${schemaChange.newType}`,
            severity: rule.severity,
            impact: rule.impact,
            recommendation: rule.recommendation
          });
        } else if (schemaChange.type === 'field_added') {
          nonBreakingChanges.push({
            type: 'field_added',
            path: schemaChange.path,
            description: `New field '${schemaChange.field}' was added`
          });
        } else if (schemaChange.type === 'enum_value_removed') {
          const rule = this.rules['enum_value_removed'];
          breakingChanges.push({
            type: 'enum_value_removed',
            path: schemaChange.path,
            description: `Enum value '${schemaChange.value}' was removed from field '${schemaChange.field}'`,
            severity: rule.severity,
            impact: rule.impact,
            recommendation: rule.recommendation
          });
        }
      });
    }
  }

  private calculateOverallSeverity(breakingChanges: BreakingChange[]): 'critical' | 'high' | 'medium' | 'low' {
    if (breakingChanges.length === 0) return 'low';
    
    const severityLevels = ['critical', 'high', 'medium', 'low'];
    const highestSeverity = breakingChanges.reduce((highest, change) => {
      const currentIndex = severityLevels.indexOf(change.severity);
      const highestIndex = severityLevels.indexOf(highest);
      return currentIndex < highestIndex ? change.severity : highest;
    }, 'low');

    return highestSeverity as 'critical' | 'high' | 'medium' | 'low';
  }

  private generateSummary(breakingChanges: BreakingChange[], nonBreakingChanges: NonBreakingChange[]): string {
    const breakingCount = breakingChanges.length;
    const nonBreakingCount = nonBreakingChanges.length;
    
    if (breakingCount === 0 && nonBreakingCount === 0) {
      return "No changes detected";
    }
    
    if (breakingCount === 0) {
      return `${nonBreakingCount} safe change${nonBreakingCount === 1 ? '' : 's'} detected`;
    }
    
    const severityCounts = breakingChanges.reduce((acc, change) => {
      acc[change.severity] = (acc[change.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityParts = Object.entries(severityCounts)
      .map(([severity, count]) => `${count} ${severity}`)
      .join(', ');

    return `${breakingCount} breaking change${breakingCount === 1 ? '' : 's'} (${severityParts}) and ${nonBreakingCount} safe change${nonBreakingCount === 1 ? '' : 's'} detected`;
  }

  getRule(ruleType: string): BreakingChangeRule | undefined {
    return this.rules[ruleType];
  }

  getAllRules(): Record<string, BreakingChangeRule> {
    return { ...this.rules };
  }
}
