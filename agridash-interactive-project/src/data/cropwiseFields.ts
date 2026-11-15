export type FieldId = 'north-field-a1' | 'east-field-b2' | 'south-field-c3';

export type FieldEquipmentStatus = 'Active' | 'Optimal' | 'Critical';

export type FieldOverviewStatus = 'Healthy' | 'Optimal' | 'Critical';

export interface CropWiseFieldData {
  name: string;
  type: string;
  score: number;
  humidity: string;
  ph: string;
  area: string;
  water: string;
  fertilizer: string;
  status: FieldEquipmentStatus;
  statusColor: string;
  dotColor: string;
}

export const FIELD_IDS: readonly FieldId[] = [
  'north-field-a1',
  'east-field-b2',
  'south-field-c3',
] as const;

/**
 * Primary field snapshot data matching MainContent.tsx `fieldData` verbatim.
 * All 11 fields, values, units, and styling classes are preserved as-is.
 * Note: `humidity` represents the field card humidity metric ('32%' / '45%' / '18%')
 * and must not be conflated with the table's separate `Soil Moisture` metric.
 */
export const cropwiseFields: Record<FieldId, CropWiseFieldData> = {
  'north-field-a1': {
    name: 'North Field A1',
    type: 'Corn Plantation',
    score: 70,
    humidity: '32%',
    ph: '2.8',
    area: '2.3',
    water: '1,250L',
    fertilizer: '87%',
    status: 'Active',
    statusColor: 'text-green-400',
    dotColor: 'bg-green-400',
  },
  'east-field-b2': {
    name: 'East Field B2',
    type: 'Wheat Plantation',
    score: 92,
    humidity: '45%',
    ph: '6.5',
    area: '4.1',
    water: '850L',
    fertilizer: '94%',
    status: 'Optimal',
    statusColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  'south-field-c3': {
    name: 'South Field C3',
    type: 'Soybean Plantation',
    score: 41,
    humidity: '18%',
    ph: '5.2',
    area: '1.8',
    water: '2,100L',
    fertilizer: '62%',
    status: 'Critical',
    statusColor: 'text-red-400',
    dotColor: 'bg-red-400',
  },
};

export function isFieldId(value: string | null | undefined): value is FieldId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(cropwiseFields, value)
  );
}

export function getFieldById(fieldId: string | null | undefined): CropWiseFieldData | null {
  return isFieldId(fieldId) ? cropwiseFields[fieldId] : null;
}

/**
 * Temporary UI display mapping for compatibility with the existing
 * "Field Monitoring Overview" badge wording in MainContent.tsx and Phase 1 placeholder pages.
 *
 * IMPORTANT: Mapping 'Active' -> 'Healthy' is strictly a presentation-layer compatibility
 * bridge. It does NOT imply that equipment status (`status: 'Active'`) and crop health
 * status are equivalent in domain semantics, and must NOT be used to infer crop health
 * changes or agronomic conclusions.
 */
export function getFieldOverviewStatus(status: FieldEquipmentStatus): FieldOverviewStatus {
  return status === 'Active' ? 'Healthy' : status;
}

/**
 * Returns the light-mode Tailwind badge classes corresponding to a field's status.
 */
export function getFieldBadgeClass(status: FieldEquipmentStatus): string {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-700';
    case 'Optimal':
      return 'bg-emerald-100 text-emerald-700';
    case 'Critical':
      return 'bg-red-100 text-red-700';
  }
}
