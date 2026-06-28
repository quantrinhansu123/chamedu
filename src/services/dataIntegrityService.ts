/** Auto-stub: Firebase removed. Migrate to Supabase. */
import { notMigrated } from '../utils/notMigrated';

export interface ValidationResult {
  canDelete: boolean;
  reason?: string;
  relatedCount?: number;
  relatedItems?: string[];
}
export interface ConsistencyIssue {
  type: 'orphaned_reference' | 'data_mismatch' | 'missing_field';
  collection: string;
  documentId: string;
  field: string;
  currentValue: any;
  expectedValue?: any;
  description: string;
}
export interface ConsistencyReport {
  checkedAt: string;
  totalIssues: number;
  issues: ConsistencyIssue[];
  summary: {
    orphanedReferences: number;
    dataMismatches: number;
    missingFields: number;
  };
}
