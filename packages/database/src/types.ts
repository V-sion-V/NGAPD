import type { ColumnType } from "kysely";

export interface SystemMetadataTable {
  key: string;
  value: string;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface DatabaseSchema {
  system_metadata: SystemMetadataTable;
}
