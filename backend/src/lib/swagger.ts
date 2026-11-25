import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

// ---------------------------------------------------------------------------
// OpenAPI spec: openapi.yaml (base) + one YAML file per resource, merged at runtime.
// ---------------------------------------------------------------------------

// Resolves to backend/src/docs both from src/lib (tsx) and dist/lib (compiled)
const DOCS_DIR = path.resolve(__dirname, '../../src/docs');

type Spec = Record<string, any>;

function load(file: string): Spec {
  return YAML.parse(fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8')) ?? {};
}

function buildSpec(): Spec {
  const spec = load('openapi.yaml');
  const resources = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.yaml') && f !== 'openapi.yaml');

  for (const file of resources) {
    const part = load(file);
    spec.paths = { ...spec.paths, ...part.paths };
    for (const [section, items] of Object.entries<Spec>(part.components ?? {})) {
      spec.components[section] = { ...spec.components[section], ...items };
    }
  }
  return spec;
}

export const swaggerSpec = buildSpec();
