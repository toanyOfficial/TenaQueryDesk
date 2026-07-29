import "server-only";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { getManagementDbPool } from "./management-db";
import { decryptTargetDbPassword, encryptTargetDbPassword } from "../crypto/db-credentials";

export type TargetConnection = Readonly<{ id:number; connectionKey:string; displayName:string; host:string; port:number; databaseName:string; username:string; encryptedPassword:string; active:boolean; createdAt:Date; checkedAt:Date|null; connectionStatus:"healthy"|"failed"|"unknown" }>;

async function ensureTable() {
  await getManagementDbPool().execute(`CREATE TABLE IF NOT EXISTS tq_db_connection (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    connection_key VARCHAR(64) NOT NULL UNIQUE, display_name VARCHAR(100) NOT NULL,
    host VARCHAR(255) NOT NULL, port INT UNSIGNED NOT NULL DEFAULT 3306,
    database_name VARCHAR(128) NOT NULL, username VARCHAR(128) NOT NULL,
    encrypted_password TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
    connection_status ENUM('healthy','failed','unknown') NOT NULL DEFAULT 'unknown',
    checked_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
const map=(r:RowDataPacket):TargetConnection=>({id:Number(r.id),connectionKey:r.connection_key,displayName:r.display_name,host:r.host,port:Number(r.port),databaseName:r.database_name,username:r.username,encryptedPassword:r.encrypted_password,active:Boolean(r.active),createdAt:new Date(r.created_at),checkedAt:r.checked_at?new Date(r.checked_at):null,connectionStatus:r.connection_status});
export async function listTargetConnections(includeInactive=false){ await ensureTable(); const [rows]=await getManagementDbPool().execute<RowDataPacket[]>(`SELECT * FROM tq_db_connection ${includeInactive?"":"WHERE active=TRUE"} ORDER BY display_name`); return rows.map(map); }
export async function getTargetConnection(id:number){ await ensureTable(); const [rows]=await getManagementDbPool().execute<RowDataPacket[]>("SELECT * FROM tq_db_connection WHERE id=? LIMIT 1",[id]); return rows[0]?map(rows[0]):null; }
export async function createTargetConnection(input:{connectionKey:string;displayName:string;host:string;port:number;databaseName:string;username:string;password:string}){ await ensureTable(); const [result]=await getManagementDbPool().execute("INSERT INTO tq_db_connection (connection_key,display_name,host,port,database_name,username,encrypted_password) VALUES (?,?,?,?,?,?,?)",[input.connectionKey,input.displayName,input.host,input.port,input.databaseName,input.username,encryptTargetDbPassword(input.password)]); return Number((result as {insertId:number}).insertId); }
export function createTargetPool(c:TargetConnection):Pool { return mysql.createPool({host:c.host,port:c.port,database:c.databaseName,user:c.username,password:decryptTargetDbPassword(c.encryptedPassword),connectionLimit:2,multipleStatements:false,connectTimeout:10000}); }
export async function testTargetConnection(id:number){ const c=await getTargetConnection(id); if(!c) throw new Error("NOT_FOUND"); const pool=createTargetPool(c); let ok=false; try { await pool.query("SELECT 1"); ok=true; } finally { await pool.end(); await getManagementDbPool().execute("UPDATE tq_db_connection SET connection_status=?, checked_at=CURRENT_TIMESTAMP(3) WHERE id=?",[ok?"healthy":"failed",id]); } }
