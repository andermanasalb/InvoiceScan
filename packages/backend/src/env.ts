/**
 * Carga el .env desde la raíz del monorepo.
 * Este archivo se require ANTES que cualquier otro módulo via nest-cli.json.
 *
 * Rutas:
 *   dev  → __dirname = packages/backend/src  → resolve('../../../.env')
 *   prod → __dirname = packages/backend/dist → resolve('../../../.env')
 *
 * En ambos casos, 3 niveles arriba desde src/ o dist/ llegamos a la raíz.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
