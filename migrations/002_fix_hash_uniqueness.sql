-- Remove global unique constraint that causes collisions
ALTER TABLE schema_versions DROP CONSTRAINT IF EXISTS schema_versions_version_hash_unique;

-- Add project+source scoped uniqueness instead  
ALTER TABLE schema_versions ADD CONSTRAINT schema_versions_project_source_hash_unique 
    UNIQUE (project_id, spec_source_id, version_hash);