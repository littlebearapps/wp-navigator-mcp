/**
 * Delta Response System
 *
 * Write operations return deltas instead of full refreshes
 * to minimize context growth.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Operation types
 */
export type OperationType = 'create' | 'update' | 'delete';

/**
 * Field-level change tracking
 */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/**
 * Delta response format for write operations
 */
export interface DeltaResponse {
  /** Operation result */
  result: 'success' | 'error';
  /** Operation type */
  operation: OperationType;
  /** Entity type (post, page, plugin, etc.) */
  entity_type: string;
  /** Entity identifier */
  entity_id: number | string;
  /** Human-readable delta description */
  delta: string;
  /** Field-level changes (for updates) */
  changes?: Record<string, FieldChange>;
  /** Updated counts */
  new_totals?: Record<string, number>;
  /** Suggested follow-up action */
  follow_up?: string;
}

/**
 * Create a success delta response for entity creation.
 *
 * @param entityType - Type of entity (post, page, etc.)
 * @param entityId - ID of created entity
 * @param title - Title/name of entity
 * @param status - Status of entity (optional)
 * @param totals - Updated totals (optional)
 * @returns DeltaResponse
 */
export function createDelta(
  entityType: string,
  entityId: number | string,
  title: string,
  status?: string,
  totals?: Record<string, number>
): DeltaResponse {
  const statusPart = status ? `, status:${status}` : '';
  return {
    result: 'success',
    operation: 'create',
    entity_type: entityType,
    entity_id: entityId,
    delta: `+1 ${entityType}: '${title}' (id:${entityId}${statusPart})`,
    new_totals: totals,
    follow_up: `Use wpnav_get_${entityType}(id:${entityId}) to view or wpnav_update_${entityType}(id:${entityId}) to edit`,
  };
}

/**
 * Create a success delta response for entity update.
 *
 * @param entityType - Type of entity
 * @param entityId - ID of updated entity
 * @param title - Title/name of entity
 * @param changes - Field-level changes
 * @returns DeltaResponse
 */
export function updateDelta(
  entityType: string,
  entityId: number | string,
  title: string,
  changes: Record<string, FieldChange>
): DeltaResponse {
  const changedFields = Object.keys(changes);
  const changesDescription = changedFields.join(', ');
  return {
    result: 'success',
    operation: 'update',
    entity_type: entityType,
    entity_id: entityId,
    delta: `~1 ${entityType}: '${title}' (id:${entityId}) updated [${changesDescription}]`,
    changes,
    follow_up: `Use wpnav_get_${entityType}(id:${entityId}) to view current state`,
  };
}

/**
 * Create a success delta response for entity deletion.
 *
 * @param entityType - Type of entity
 * @param entityId - ID of deleted entity
 * @param title - Title/name of deleted entity
 * @param totals - Updated totals (optional)
 * @returns DeltaResponse
 */
export function deleteDelta(
  entityType: string,
  entityId: number | string,
  title: string,
  totals?: Record<string, number>
): DeltaResponse {
  return {
    result: 'success',
    operation: 'delete',
    entity_type: entityType,
    entity_id: entityId,
    delta: `-1 ${entityType}: '${title}' (id:${entityId}) deleted`,
    new_totals: totals,
    follow_up: `Use wpnav_list_${entityType}s() to view remaining items`,
  };
}

/**
 * Create an error delta response.
 *
 * @param operation - Operation that failed
 * @param entityType - Type of entity
 * @param entityId - ID of entity (if known)
 * @param errorMessage - Error message
 * @returns DeltaResponse
 */
export function errorDelta(
  operation: OperationType,
  entityType: string,
  entityId: number | string | undefined,
  errorMessage: string
): DeltaResponse {
  const idPart = entityId ? ` (id:${entityId})` : '';
  return {
    result: 'error',
    operation,
    entity_type: entityType,
    entity_id: entityId ?? 'unknown',
    delta: `Failed to ${operation} ${entityType}${idPart}: ${errorMessage}`,
  };
}

/**
 * Extract changes between old and new object.
 *
 * @param oldObj - Original object
 * @param newObj - Updated object
 * @param fields - Fields to compare (optional, compares all if not provided)
 * @returns Record of field changes
 */
export function extractChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields?: string[]
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  const fieldsToCompare = fields ?? Object.keys(newObj);

  for (const field of fieldsToCompare) {
    if (field in newObj && oldObj[field] !== newObj[field]) {
      changes[field] = {
        from: oldObj[field],
        to: newObj[field],
      };
    }
  }

  return changes;
}
