import * as path from 'node:path';
import { ProjectServiceRegistry } from './project-service-registry.js';
import { LegacyProjectServiceRegistry } from './legacy-project-service-registry.js';

/** Owns compiler resources for one repository. Adapters borrow them until clear(). */
export class RepositoryAnalysisContext {
  readonly root: string;
  readonly nativeRegistry: ProjectServiceRegistry;
  readonly legacyRegistry: LegacyProjectServiceRegistry;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.nativeRegistry = new ProjectServiceRegistry(this.root);
    this.legacyRegistry = new LegacyProjectServiceRegistry(this.root);
  }

  /** Call only after analyses finish; existing adapters must not be reused afterward. */
  async clear(): Promise<void> {
    const results = await Promise.allSettled([
      this.nativeRegistry.clear(),
      Promise.resolve().then(() => this.legacyRegistry.clear()),
    ]);
    const failures = results.filter(result => result.status === 'rejected');

    if (failures.length) {
      throw new AggregateError(failures.map(result => result.reason), `Failed to clear repository analysis context for ${this.root}`);
    }
  }
}
