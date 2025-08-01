interface BreakingChange {
  type: string;
  path: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  recommendation: string;
}

interface AnalysisResult {
  breakingChanges: BreakingChange[];
  nonBreakingChanges: any[];
  summary: string;
}

export class BreakingChangeAnalyzer {
  analyzeChanges(comparison: any): AnalysisResult {
    const breakingChanges: BreakingChange[] = [];
    const nonBreakingChanges: any[] = [];

    // Analyze removed paths (CRITICAL)
    if (comparison.removedPaths) {
      comparison.removedPaths.forEach((path: string) => {
        breakingChanges.push({
          type: 'endpoint_removed',
          path,
          description: `API endpoint removed: ${path}`,
          severity: 'critical',
          impact: 'Clients calling this endpoint will receive 404 errors',
          recommendation: 'Deprecate endpoint first, then remove after grace period'
        });
      });
    }

    // Analyze modified paths
    if (comparison.modifiedPaths) {
      comparison.modifiedPaths.forEach((pathMod: any) => {
        // Removed methods (CRITICAL)
        if (pathMod.removedMethods) {
          pathMod.removedMethods.forEach((method: string) => {
            breakingChanges.push({
              type: 'method_removed',
              path: `${pathMod.path} ${method.toUpperCase()}`,
              description: `HTTP method removed: ${method.toUpperCase()} ${pathMod.path}`,
              severity: 'critical',
              impact: 'Clients using this HTTP method will receive 405 Method Not Allowed errors',
              recommendation: 'Add deprecation warning before removing methods'
            });
          });
        }

        // Method modifications
        if (pathMod.modifiedMethods) {
          pathMod.modifiedMethods.forEach((methodMod: any) => {
            methodMod.changes.forEach((change: string) => {
              if (change.includes('required') && change.includes('added')) {
                breakingChanges.push({
                  type: 'required_param_added',
                  path: `${pathMod.path} ${methodMod.method.toUpperCase()}`,
                  description: `Required parameter added: ${change}`,
                  severity: 'critical',
                  impact: 'Existing clients will send invalid requests missing the required parameter',
                  recommendation: 'Make parameter optional with sensible defaults, or version the API'
                });
              } else if (change.includes('now required')) {
                breakingChanges.push({
                  type: 'param_became_required',
                  path: `${pathMod.path} ${methodMod.method.toUpperCase()}`,
                  description: change,
                  severity: 'critical',
                  impact: 'Existing clients may not provide this parameter',
                  recommendation: 'Use API versioning or provide backwards compatibility'
                });
              } else {
                nonBreakingChanges.push({
                  type: 'method_modified',
                  path: `${pathMod.path} ${methodMod.method.toUpperCase()}`,
                  description: change
                });
              }
            });
          });
        }
      });
    }

    // Analyze schema changes
    if (comparison.schemaChanges) {
      comparison.schemaChanges.forEach((change: any) => {
        switch (change.type) {
          case 'field_removed':
            breakingChanges.push({
              type: 'response_field_removed',
              path: `${change.path}.${change.field}`,
              description: `Response field removed: ${change.field} from ${change.path}`,
              severity: 'high',
              impact: 'Client code expecting this field may break or behave unexpectedly',
              recommendation: 'Deprecate field first, return null/empty values during transition'
            });
            break;
          case 'field_type_changed':
            breakingChanges.push({
              type: 'field_type_changed',
              path: `${change.path}.${change.field}`,
              description: `Field type changed: ${change.field} from ${change.oldType} to ${change.newType}`,
              severity: 'high',
              impact: 'Clients may fail to parse responses or send incorrect data types',
              recommendation: 'Use API versioning or introduce new field with different name'
            });
            break;
          case 'enum_value_removed':
            breakingChanges.push({
              type: 'enum_value_removed',
              path: `${change.path}.${change.field}`,
              description: `Enum value removed: ${change.value} from ${change.field}`,
              severity: 'medium',
              impact: 'Clients sending removed enum values will receive validation errors',
              recommendation: 'Deprecate enum values and handle gracefully in API logic'
            });
            break;
          case 'field_added':
            nonBreakingChanges.push({
              type: 'field_added',
              path: `${change.path}.${change.field}`,
              description: `New field added: ${change.field} to ${change.path}`
            });
            break;
        }
      });
    }

    const summary = `Found ${breakingChanges.length} breaking changes and ${nonBreakingChanges.length} safe changes`;

    return {
      breakingChanges,
      nonBreakingChanges,
      summary
    };
  }
}