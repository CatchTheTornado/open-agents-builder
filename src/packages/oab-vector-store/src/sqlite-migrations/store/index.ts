import { migration as createInitialTables } from './001_create_initial_tables';
import { migration as addSessionAndExpiry } from './002_add_session_and_expiry';
import { migration as renameVectorId } from './003_rename_vector_id';

export const storeMigrations = [
  createInitialTables,
  addSessionAndExpiry,
  renameVectorId
]; 