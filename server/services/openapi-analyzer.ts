import SwaggerParser from "@apidevtools/swagger-parser";

interface SchemaComparison {
  removedPaths?: string[];
  addedPaths?: string[];
  modifiedPaths?: PathModification[];
  parameterChanges?: ParameterChange[];
  schemaChanges?: SchemaChange[];
}

interface PathModification {
  path: string;
  removedMethods?: string[];
  addedMethods?: string[];
  modifiedMethods?: MethodModification[];
}

interface MethodModification {
  method: string;
  changes: string[];
}

interface ParameterChange {
  type: string;
  path: string;
  parameter: string;
  location: string; // query, header, path, body
}

interface SchemaChange {
  type: string;
  path: string;
  field?: string;
  oldType?: string;
  newType?: string;
  value?: string;
}

export class OpenAPIAnalyzer {
  async compareSchemas(oldSchema: any, newSchema: any): Promise<SchemaComparison> {
    try {
      // Parse and validate schemas
      const oldParsed = await SwaggerParser.validate(oldSchema);
      const newParsed = await SwaggerParser.validate(newSchema);

      const comparison: SchemaComparison = {};

      // Compare paths
      this.comparePaths(oldParsed, newParsed, comparison);
      
      // Compare schemas/components
      this.compareSchemaDefinitions(oldParsed, newParsed, comparison);
      
      // Compare parameters
      this.compareParameters(oldParsed, newParsed, comparison);

      return comparison;
    } catch (error) {
      console.error("Error comparing schemas:", error);
      throw new Error(`Schema comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private comparePaths(oldSchema: any, newSchema: any, comparison: SchemaComparison): void {
    const oldPaths = Object.keys(oldSchema.paths || {});
    const newPaths = Object.keys(newSchema.paths || {});

    // Find removed paths
    const removedPaths = oldPaths.filter(path => !newPaths.includes(path));
    if (removedPaths.length > 0) {
      comparison.removedPaths = removedPaths;
    }

    // Find added paths
    const addedPaths = newPaths.filter(path => !oldPaths.includes(path));
    if (addedPaths.length > 0) {
      comparison.addedPaths = addedPaths;
    }

    // Find modified paths
    const modifiedPaths: PathModification[] = [];
    const commonPaths = oldPaths.filter(path => newPaths.includes(path));

    commonPaths.forEach(path => {
      const pathMod = this.comparePathMethods(
        oldSchema.paths[path],
        newSchema.paths[path],
        path
      );
      if (pathMod) {
        modifiedPaths.push(pathMod);
      }
    });

    if (modifiedPaths.length > 0) {
      comparison.modifiedPaths = modifiedPaths;
    }
  }

  private comparePathMethods(oldPathDef: any, newPathDef: any, path: string): PathModification | null {
    const oldMethods = Object.keys(oldPathDef);
    const newMethods = Object.keys(newPathDef);

    const removedMethods = oldMethods.filter(method => !newMethods.includes(method));
    const addedMethods = newMethods.filter(method => !oldMethods.includes(method));
    const modifiedMethods: MethodModification[] = [];

    // Check for method modifications
    const commonMethods = oldMethods.filter(method => newMethods.includes(method));
    commonMethods.forEach(method => {
      const changes = this.compareMethodDefinitions(oldPathDef[method], newPathDef[method]);
      if (changes.length > 0) {
        modifiedMethods.push({ method, changes });
      }
    });

    if (removedMethods.length > 0 || addedMethods.length > 0 || modifiedMethods.length > 0) {
      return {
        path,
        removedMethods: removedMethods.length > 0 ? removedMethods : undefined,
        addedMethods: addedMethods.length > 0 ? addedMethods : undefined,
        modifiedMethods: modifiedMethods.length > 0 ? modifiedMethods : undefined,
      };
    }

    return null;
  }

  private compareMethodDefinitions(oldMethod: any, newMethod: any): string[] {
    const changes: string[] = [];

    // Compare parameters
    const oldParams = oldMethod.parameters || [];
    const newParams = newMethod.parameters || [];
    
    const paramChanges = this.compareMethodParameters(oldParams, newParams);
    changes.push(...paramChanges);

    // Compare request body
    if (oldMethod.requestBody && !newMethod.requestBody) {
      changes.push("Request body removed");
    } else if (!oldMethod.requestBody && newMethod.requestBody) {
      changes.push("Request body added");
    }

    // Compare responses
    const responseChanges = this.compareResponses(oldMethod.responses, newMethod.responses);
    changes.push(...responseChanges);

    return changes;
  }

  private compareMethodParameters(oldParams: any[], newParams: any[]): string[] {
    const changes: string[] = [];
    
    // Check for removed parameters
    oldParams.forEach(oldParam => {
      const found = newParams.find(newParam => 
        newParam.name === oldParam.name && newParam.in === oldParam.in
      );
      if (!found) {
        changes.push(`Parameter '${oldParam.name}' (${oldParam.in}) removed`);
      }
    });

    // Check for added parameters
    newParams.forEach(newParam => {
      const found = oldParams.find(oldParam => 
        oldParam.name === newParam.name && oldParam.in === newParam.in
      );
      if (!found) {
        const required = newParam.required ? "required" : "optional";
        changes.push(`Parameter '${newParam.name}' (${newParam.in}) added as ${required}`);
      }
    });

    // Check for parameter requirement changes
    oldParams.forEach(oldParam => {
      const newParam = newParams.find(p => 
        p.name === oldParam.name && p.in === oldParam.in
      );
      if (newParam) {
        if (!oldParam.required && newParam.required) {
          changes.push(`Parameter '${oldParam.name}' (${oldParam.in}) is now required`);
        } else if (oldParam.required && !newParam.required) {
          changes.push(`Parameter '${oldParam.name}' (${oldParam.in}) is now optional`);
        }
      }
    });

    return changes;
  }

  private compareResponses(oldResponses: any, newResponses: any): string[] {
    const changes: string[] = [];
    
    if (!oldResponses || !newResponses) return changes;

    const oldCodes = Object.keys(oldResponses);
    const newCodes = Object.keys(newResponses);

    // Check for removed response codes
    oldCodes.forEach(code => {
      if (!newCodes.includes(code)) {
        changes.push(`Response ${code} removed`);
      }
    });

    // Check for added response codes
    newCodes.forEach(code => {
      if (!oldCodes.includes(code)) {
        changes.push(`Response ${code} added`);
      }
    });

    return changes;
  }

  private compareParameters(oldSchema: any, newSchema: any, comparison: SchemaComparison): void {
    const parameterChanges: ParameterChange[] = [];

    // This would analyze global parameters if defined
    // Implementation depends on specific OpenAPI structure

    if (parameterChanges.length > 0) {
      comparison.parameterChanges = parameterChanges;
    }
  }

  private compareSchemaDefinitions(oldSchema: any, newSchema: any, comparison: SchemaComparison): void {
    const schemaChanges: SchemaChange[] = [];

    // Compare OpenAPI 3.x components/schemas or Swagger 2.x definitions
    const oldSchemas = oldSchema.components?.schemas || oldSchema.definitions || {};
    const newSchemas = newSchema.components?.schemas || newSchema.definitions || {};

    const oldSchemaNames = Object.keys(oldSchemas);
    const newSchemaNames = Object.keys(newSchemas);

    // Compare common schemas
    const commonSchemas = oldSchemaNames.filter(name => newSchemaNames.includes(name));
    
    commonSchemas.forEach(schemaName => {
      const oldSchemaDef = oldSchemas[schemaName];
      const newSchemaDef = newSchemas[schemaName];
      
      const changes = this.compareSchemaProperties(oldSchemaDef, newSchemaDef, schemaName);
      schemaChanges.push(...changes);
    });

    if (schemaChanges.length > 0) {
      comparison.schemaChanges = schemaChanges;
    }
  }

  private compareSchemaProperties(oldSchema: any, newSchema: any, schemaName: string): SchemaChange[] {
    const changes: SchemaChange[] = [];
    
    if (!oldSchema.properties || !newSchema.properties) {
      return changes;
    }

    const oldProps = Object.keys(oldSchema.properties);
    const newProps = Object.keys(newSchema.properties);

    // Check for removed properties
    oldProps.forEach(prop => {
      if (!newProps.includes(prop)) {
        changes.push({
          type: 'field_removed',
          path: schemaName,
          field: prop
        });
      }
    });

    // Check for added properties
    newProps.forEach(prop => {
      if (!oldProps.includes(prop)) {
        changes.push({
          type: 'field_added',
          path: schemaName,
          field: prop
        });
      }
    });

    // Check for type changes
    oldProps.forEach(prop => {
      if (newProps.includes(prop)) {
        const oldType = oldSchema.properties[prop].type;
        const newType = newSchema.properties[prop].type;
        
        if (oldType !== newType) {
          changes.push({
            type: 'field_type_changed',
            path: schemaName,
            field: prop,
            oldType,
            newType
          });
        }

        // Check for enum changes
        const oldEnum = oldSchema.properties[prop].enum;
        const newEnum = newSchema.properties[prop].enum;
        
        if (oldEnum && newEnum) {
          const removedValues = oldEnum.filter((val: any) => !newEnum.includes(val));
          removedValues.forEach((val: any) => {
            changes.push({
              type: 'enum_value_removed',
              path: schemaName,
              field: prop,
              value: val
            });
          });
        }
      }
    });

    return changes;
  }

  async validateSchema(schema: any): Promise<boolean> {
    try {
      await SwaggerParser.validate(schema);
      return true;
    } catch (error) {
      console.error("Schema validation failed:", error);
      return false;
    }
  }

  async dereferenceSchema(schema: any): Promise<any> {
    try {
      return await SwaggerParser.dereference(schema);
    } catch (error) {
      console.error("Schema dereferencing failed:", error);
      throw error;
    }
  }
}
