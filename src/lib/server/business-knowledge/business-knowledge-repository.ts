import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getManagementDbPool } from "@/lib/server/db/management-db";
import { BusinessKnowledgeError, type BusinessKnowledgeEntry, type BusinessKnowledgeInput, type KnowledgeStatus, type KnowledgeType } from "./business-knowledge-types";

let ready: Promise<void> | null = null;
export function ensureBusinessKnowledgeTables(): Promise<void> {
  return ready ??= initialize().catch((error) => { ready = null; throw error; });
}

async function initialize(): Promise<void> {
  const db = getManagementDbPool();
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_business_knowledge (
    id CHAR(36) PRIMARY KEY, connection_id BIGINT UNSIGNED NULL, scope_key BIGINT UNSIGNED AS (COALESCE(connection_id,0)) STORED,
    knowledge_type ENUM('term','status_value','metric','representative','relationship','filter_rule','sensitivity') NOT NULL,
    knowledge_key VARCHAR(128) NOT NULL, title VARCHAR(160) NOT NULL, description TEXT NOT NULL,
    status ENUM('draft','active','deprecated','archived','invalid') NOT NULL DEFAULT 'draft',
    priority INT UNSIGNED NOT NULL DEFAULT 100, source VARCHAR(500) NOT NULL,
    confidence ENUM('verified','reviewed','inferred') NOT NULL DEFAULT 'reviewed',
    effective_from DATE NULL, effective_to DATE NULL, tags_json JSON NOT NULL,
    example_text TEXT NULL, cautions_json JSON NOT NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
    schema_version VARCHAR(32) NULL, validation_status ENUM('valid','invalid','unverified') NOT NULL DEFAULT 'unverified',
    validation_errors_json JSON NOT NULL, last_validated_at DATETIME(3) NULL,
    created_by VARCHAR(128) NOT NULL, updated_by VARCHAR(128) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_tq_bk_scope_key(scope_key,knowledge_key),
    INDEX idx_tq_bk_scope_status(connection_id,status,knowledge_type), INDEX idx_tq_bk_updated(updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_business_knowledge_alias (
    knowledge_id CHAR(36) NOT NULL, alias_text VARCHAR(160) NOT NULL,
    PRIMARY KEY(knowledge_id,alias_text), INDEX idx_tq_bk_alias(alias_text)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_business_knowledge_target (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, knowledge_id CHAR(36) NOT NULL,
    target_type ENUM('table','column','relationship','value') NOT NULL,
    table_name VARCHAR(128) NOT NULL, column_name VARCHAR(128) NULL,
    referenced_table VARCHAR(128) NULL, referenced_column VARCHAR(128) NULL, target_value VARCHAR(500) NULL,
    relation_kind ENUM('foreign_key','logical','inferred','legacy') NULL, cardinality VARCHAR(32) NULL,
    sensitivity ENUM('public','internal','personal','secret','restricted') NULL,
    INDEX idx_tq_bk_target(knowledge_id), INDEX idx_tq_bk_column(table_name,column_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_business_metric (
    knowledge_id CHAR(36) PRIMARY KEY, base_table VARCHAR(128) NOT NULL, date_column VARCHAR(128) NOT NULL,
    aggregation_type ENUM('count','count_distinct','sum','avg','ratio','custom_reference') NOT NULL,
    aggregation_expression VARCHAR(1000) NULL, distinct_key VARCHAR(128) NULL, amount_expression VARCHAR(1000) NULL,
    timezone_name VARCHAR(64) NOT NULL, null_policy ENUM('exclude','zero','include') NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_business_rule_condition (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, knowledge_id CHAR(36) NOT NULL,
    rule_type ENUM('include','exclude') NOT NULL, table_alias VARCHAR(128) NULL, column_name VARCHAR(128) NOT NULL,
    operator ENUM('eq','neq','in','not_in','is_null','is_not_null','gt','gte','lt','lte') NOT NULL,
    condition_value VARCHAR(1000) NULL, value_type ENUM('string','number','boolean','date','null') NOT NULL,
    group_no INT UNSIGNED NOT NULL, sequence_no INT UNSIGNED NOT NULL,
    INDEX idx_tq_bk_rule(knowledge_id,group_no,sequence_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_business_knowledge_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, knowledge_id CHAR(36) NOT NULL,
    from_version INT UNSIGNED NULL, to_version INT UNSIGNED NOT NULL, changed_by VARCHAR(128) NOT NULL,
    action VARCHAR(32) NOT NULL, changed_fields_json JSON NOT NULL, status_from VARCHAR(16) NULL, status_to VARCHAR(16) NOT NULL,
    validation_json JSON NULL, conflict_detected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX idx_tq_bk_audit(knowledge_id,to_version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tq_agent_run_business_knowledge (
    run_id CHAR(36) NOT NULL, knowledge_id CHAR(36) NOT NULL, knowledge_version INT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(run_id,knowledge_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function createKnowledge(input: BusinessKnowledgeInput, actor: string): Promise<BusinessKnowledgeEntry> {
  await ensureBusinessKnowledgeTables();
  const db = getManagementDbPool();
  const connection = await db.getConnection();
  const id = crypto.randomUUID();
  try {
    await connection.beginTransaction();
    await insertEntry(connection, id, input, actor);
    await replaceChildren(connection, id, input);
    await writeAudit(connection, id, null, 1, actor, "create", [], null, input.status, null, false);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_DUPLICATED", "같은 범위에 동일한 업무 지식 key가 있습니다.");
    throw error;
  } finally { connection.release(); }
  return getKnowledge(id, input.connectionId, false);
}

export async function updateKnowledge(id: string, input: BusinessKnowledgeInput, expectedVersion: number, actor: string): Promise<BusinessKnowledgeEntry> {
  await ensureBusinessKnowledgeTables();
  const db = getManagementDbPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute<RowDataPacket[]>("SELECT version,status FROM tq_business_knowledge WHERE id=? FOR UPDATE", [id]);
    if (!existing[0]) throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_NOT_FOUND", "업무 지식을 찾을 수 없습니다.");
    if (Number(existing[0].version) !== expectedVersion) throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_VERSION_CONFLICT", "다른 관리자가 먼저 수정했습니다.", true);
    const nextVersion = expectedVersion + 1;
    await connection.execute(`UPDATE tq_business_knowledge SET connection_id=?,knowledge_type=?,knowledge_key=?,title=?,description=?,status=?,priority=?,source=?,confidence=?,effective_from=?,effective_to=?,tags_json=?,example_text=?,cautions_json=?,version=?,updated_by=?,updated_at=CURRENT_TIMESTAMP(3),validation_status='unverified' WHERE id=?`, values(input, nextVersion, actor, id));
    await replaceChildren(connection, id, input);
    await writeAudit(connection, id, expectedVersion, nextVersion, actor, "update", ["content"], existing[0].status, input.status, null, false);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  return getKnowledge(id, input.connectionId, false);
}

export async function getKnowledge(id: string, connectionId: number | null, activeOnly = true): Promise<BusinessKnowledgeEntry> {
  await ensureBusinessKnowledgeTables();
  const [rows] = await getManagementDbPool().execute<RowDataPacket[]>(`SELECT * FROM tq_business_knowledge WHERE id=? AND (connection_id IS NULL OR connection_id=?) ${activeOnly ? "AND status='active' AND validation_status='valid'" : ""} LIMIT 1`, [id, connectionId]);
  if (!rows[0]) throw new BusinessKnowledgeError("BUSINESS_KNOWLEDGE_NOT_FOUND", "업무 지식을 찾을 수 없습니다.");
  return hydrate(rows[0]);
}

export async function listKnowledge(input: { connectionId: number; query?: string; type?: KnowledgeType; status?: KnowledgeStatus; limit: number; activeOnly?: boolean }): Promise<BusinessKnowledgeEntry[]> {
  await ensureBusinessKnowledgeTables();
  const params: Array<string | number | boolean | null> = [input.connectionId];
  const where = ["(k.connection_id IS NULL OR k.connection_id=?)"];
  if (input.activeOnly) where.push("k.status='active'", "k.validation_status='valid'");
  else if (input.status) { where.push("k.status=?"); params.push(input.status); }
  if (input.type) { where.push("k.knowledge_type=?"); params.push(input.type); }
  if (input.query?.trim()) {
    const query = `%${input.query.trim().slice(0, 200)}%`;
    where.push("(k.title LIKE ? OR k.knowledge_key LIKE ? OR k.description LIKE ? OR k.source LIKE ? OR EXISTS (SELECT 1 FROM tq_business_knowledge_alias a WHERE a.knowledge_id=k.id AND a.alias_text LIKE ?) OR EXISTS (SELECT 1 FROM tq_business_knowledge_target t WHERE t.knowledge_id=k.id AND (t.table_name LIKE ? OR t.column_name LIKE ? OR t.target_value LIKE ?)))");
    params.push(query, query, query, query, query, query, query, query);
  }
  params.push(input.limit);
  const [rows] = await getManagementDbPool().execute<RowDataPacket[]>(`SELECT k.* FROM tq_business_knowledge k WHERE ${where.join(" AND ")} ORDER BY k.priority DESC,k.updated_at DESC LIMIT ?`, params);
  return Promise.all(rows.map(hydrate));
}

export async function findConflicts(input: BusinessKnowledgeInput, excludeId?: string): Promise<string[]> {
  await ensureBusinessKnowledgeTables();
  const params: Array<string | number | boolean | null> = [input.connectionId, input.connectionId, input.key, input.effectiveTo ?? "9999-12-31", input.effectiveFrom ?? "1000-01-01"];
  let sql = `SELECT id FROM tq_business_knowledge WHERE status='active' AND ((connection_id IS NULL AND ? IS NULL) OR connection_id=?) AND knowledge_key=? AND COALESCE(effective_from,'1000-01-01')<=? AND COALESCE(effective_to,'9999-12-31')>=?`;
  if (excludeId) { sql += " AND id<>?"; params.push(excludeId); }
  const [rows] = await getManagementDbPool().execute<RowDataPacket[]>(sql, params);
  return rows.map((row) => String(row.id));
}

export async function saveValidation(id: string, validation: { valid: boolean; schemaVersion: string | null; errors: readonly unknown[] }, invalidate: boolean): Promise<void> {
  await ensureBusinessKnowledgeTables();
  const status = validation.valid ? "valid" : "invalid";
  await getManagementDbPool().execute(`UPDATE tq_business_knowledge SET validation_status=?,validation_errors_json=?,schema_version=?,last_validated_at=CURRENT_TIMESTAMP(3),status=IF(? AND status='active','invalid',status) WHERE id=?`, [status, JSON.stringify(validation.errors), validation.schemaVersion, invalidate, id]);
  await getManagementDbPool().execute(`INSERT INTO tq_business_knowledge_audit (knowledge_id,from_version,to_version,changed_by,action,changed_fields_json,status_from,status_to,validation_json,conflict_detected) SELECT id,version,version,'system','validate',JSON_ARRAY('validation'),status,status,?,FALSE FROM tq_business_knowledge WHERE id=?`, [JSON.stringify(validation), id]);
}

export async function listAudit(id: string): Promise<unknown[]> {
  await ensureBusinessKnowledgeTables();
  const [rows] = await getManagementDbPool().execute<RowDataPacket[]>("SELECT from_version AS fromVersion,to_version AS toVersion,changed_by AS changedBy,action,status_from AS statusFrom,status_to AS statusTo,validation_json AS validation,conflict_detected AS conflictDetected,created_at AS createdAt FROM tq_business_knowledge_audit WHERE knowledge_id=? ORDER BY to_version DESC", [id]);
  return rows;
}

export async function recordRunKnowledge(runId: string, references: ReadonlyArray<{ id: string; version: number }>): Promise<void> {
  if (!references.length) return;
  await ensureBusinessKnowledgeTables();
  for (const reference of references) await getManagementDbPool().execute("INSERT IGNORE INTO tq_agent_run_business_knowledge (run_id,knowledge_id,knowledge_version) VALUES (?,?,?)", [runId, reference.id, reference.version]);
}

async function hydrate(row: RowDataPacket): Promise<BusinessKnowledgeEntry> {
  const db = getManagementDbPool();
  const [[aliases], [targets], [metrics], [conditions]] = await Promise.all([
    db.execute<RowDataPacket[]>("SELECT alias_text FROM tq_business_knowledge_alias WHERE knowledge_id=? ORDER BY alias_text", [row.id]),
    db.execute<RowDataPacket[]>("SELECT target_type AS targetType,table_name AS tableName,column_name AS columnName,referenced_table AS referencedTable,referenced_column AS referencedColumn,target_value AS targetValue,relation_kind AS relationKind,cardinality,sensitivity FROM tq_business_knowledge_target WHERE knowledge_id=? ORDER BY id", [row.id]),
    db.execute<RowDataPacket[]>("SELECT base_table AS baseTable,date_column AS dateColumn,aggregation_type AS aggregationType,aggregation_expression AS aggregationExpression,distinct_key AS distinctKey,amount_expression AS amountExpression,timezone_name AS timezone,null_policy AS nullPolicy FROM tq_business_metric WHERE knowledge_id=?", [row.id]),
    db.execute<RowDataPacket[]>("SELECT rule_type AS ruleType,table_alias AS tableAlias,column_name AS columnName,operator,condition_value AS value,value_type AS valueType,group_no AS groupNo,sequence_no AS sequence FROM tq_business_rule_condition WHERE knowledge_id=? ORDER BY group_no,sequence_no", [row.id]),
  ]);
  return {
    id: row.id, connectionId: row.connection_id == null ? null : Number(row.connection_id), type: row.knowledge_type,
    key: row.knowledge_key, title: row.title, description: row.description, status: row.status,
    priority: Number(row.priority), source: row.source, confidence: row.confidence,
    effectiveFrom: date(row.effective_from), effectiveTo: date(row.effective_to), aliases: aliases.map((item) => item.alias_text),
    targets, metric: metrics[0] ?? null, conditions, tags: json(row.tags_json), example: row.example_text,
    cautions: json(row.cautions_json), version: Number(row.version), schemaVersion: row.schema_version,
    validationStatus: row.validation_status, validationErrors: json(row.validation_errors_json),
    lastValidatedAt: row.last_validated_at ? new Date(row.last_validated_at).toISOString() : null,
    createdBy: row.created_by, updatedBy: row.updated_by, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  } as unknown as BusinessKnowledgeEntry;
}

async function insertEntry(connection: PoolConnection, id: string, input: BusinessKnowledgeInput, actor: string) {
  await connection.execute(`INSERT INTO tq_business_knowledge (id,connection_id,knowledge_type,knowledge_key,title,description,status,priority,source,confidence,effective_from,effective_to,tags_json,example_text,cautions_json,created_by,updated_by,validation_errors_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,JSON_ARRAY())`, [id, input.connectionId, input.type, input.key, input.title, input.description, input.status, input.priority, input.source, input.confidence, input.effectiveFrom ?? null, input.effectiveTo ?? null, JSON.stringify(input.tags), input.example ?? null, JSON.stringify(input.cautions), actor, actor]);
}

async function replaceChildren(connection: PoolConnection, id: string, input: BusinessKnowledgeInput) {
  await Promise.all(["tq_business_knowledge_alias", "tq_business_knowledge_target", "tq_business_metric", "tq_business_rule_condition"].map((table) => connection.execute(`DELETE FROM ${table} WHERE knowledge_id=?`, [id])));
  for (const alias of input.aliases) await connection.execute("INSERT INTO tq_business_knowledge_alias (knowledge_id,alias_text) VALUES (?,?)", [id, alias.slice(0, 160)]);
  for (const target of input.targets) await connection.execute("INSERT INTO tq_business_knowledge_target (knowledge_id,target_type,table_name,column_name,referenced_table,referenced_column,target_value,relation_kind,cardinality,sensitivity) VALUES (?,?,?,?,?,?,?,?,?,?)", [id, target.targetType, target.tableName, target.columnName ?? null, target.referencedTable ?? null, target.referencedColumn ?? null, target.targetValue ?? null, target.relationKind ?? null, target.cardinality ?? null, target.sensitivity ?? null]);
  if (input.metric) await connection.execute("INSERT INTO tq_business_metric (knowledge_id,base_table,date_column,aggregation_type,aggregation_expression,distinct_key,amount_expression,timezone_name,null_policy) VALUES (?,?,?,?,?,?,?,?,?)", [id, input.metric.baseTable, input.metric.dateColumn, input.metric.aggregationType, input.metric.aggregationExpression ?? null, input.metric.distinctKey ?? null, input.metric.amountExpression ?? null, input.metric.timezone, input.metric.nullPolicy]);
  for (const rule of input.conditions) await connection.execute("INSERT INTO tq_business_rule_condition (knowledge_id,rule_type,table_alias,column_name,operator,condition_value,value_type,group_no,sequence_no) VALUES (?,?,?,?,?,?,?,?,?)", [id, rule.ruleType, rule.tableAlias ?? null, rule.columnName, rule.operator, rule.value ?? null, rule.valueType, rule.groupNo, rule.sequence]);
}

function values(input: BusinessKnowledgeInput, version: number, actor: string, id: string): Array<string | number | null> {
  return [input.connectionId, input.type, input.key, input.title, input.description, input.status, input.priority, input.source, input.confidence, input.effectiveFrom ?? null, input.effectiveTo ?? null, JSON.stringify(input.tags), input.example ?? null, JSON.stringify(input.cautions), version, actor, id];
}
async function writeAudit(connection: PoolConnection, id: string, from: number | null, to: number, actor: string, action: string, fields: string[], statusFrom: string | null, statusTo: string, validation: unknown, conflict: boolean) {
  await connection.execute("INSERT INTO tq_business_knowledge_audit (knowledge_id,from_version,to_version,changed_by,action,changed_fields_json,status_from,status_to,validation_json,conflict_detected) VALUES (?,?,?,?,?,?,?,?,?,?)", [id, from, to, actor, action, JSON.stringify(fields), statusFrom, statusTo, validation ? JSON.stringify(validation) : null, conflict]);
}
function json(value: unknown): never[] { return (typeof value === "string" ? JSON.parse(value) : value) ?? []; }
function date(value: unknown): string | null { return value ? new Date(value as string).toISOString().slice(0, 10) : null; }
