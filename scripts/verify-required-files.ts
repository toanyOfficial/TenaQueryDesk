import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

type Manifest = { version: number; requiredFiles: string[]; optionalFiles?: string[]; optionalAny?: Array<{ label: string; files: string[] }> };
const manifestPath = process.env.REQUIRED_FILES_MANIFEST || "config/required-files.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8")) as Manifest;
const git = (args: string[]) => Bun.spawnSync(["git", ...args], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
const hasGit = git(["rev-parse", "--is-inside-work-tree"]);
const missing: string[] = [], notFiles: string[] = [], untracked: string[] = [], absentFromHead: string[] = [], differsFromHead: string[] = [];

for (const path of manifest.requiredFiles) {
  try {
    if (!(await stat(resolve(path))).isFile()) notFiles.push(path);
  } catch {
    missing.push(path);
    continue;
  }
  if (hasGit) {
    if (!git(["ls-files", "--error-unmatch", "--", path])) untracked.push(path);
    if (!git(["cat-file", "-e", `HEAD:${path}`])) absentFromHead.push(path);
    else if (!git(["diff", "--quiet", "HEAD", "--", path])) differsFromHead.push(path);
  }
}

const optionalPresent: string[] = [], optionalMissing: string[] = [];
for (const path of manifest.optionalFiles ?? []) {
  try {
    (await stat(resolve(path))).isFile() ? optionalPresent.push(path) : optionalMissing.push(path);
  } catch { optionalMissing.push(path); }
}

console.log(`필수 파일 manifest v${manifest.version}: ${manifest.requiredFiles.length}개`);
console.log(`Git 검증: ${hasGit ? "수행" : "건너뜀 (.git 없음)"}`);
if (optionalPresent.length) console.log(`선택 파일 존재: ${optionalPresent.join(", ")}`);
if (optionalMissing.length) console.warn(`선택 파일 없음: ${optionalMissing.join(", ")}`);
for (const group of manifest.optionalAny ?? []) {
  const present = [];
  for (const path of group.files) {
    try { if ((await stat(resolve(path))).isFile()) present.push(path); } catch { /* optional */ }
  }
  console[present.length ? "log" : "warn"](`${group.label}: ${present.length ? present.join(", ") : `없음 (${group.files.join(" 또는 ")})`}`);
}

const print = (title: string, values: string[]) => { if (values.length) console.error(`${title}:\n${values.map(path => `- ${path}`).join("\n")}`); };
print("누락", missing);
print("정상 파일이 아님", notFiles);
print("Git 추적 안 됨", untracked);
print("working tree 존재, HEAD 미포함", absentFromHead);
print("HEAD와 내용 다름 (수정 또는 staged)", differsFromHead);

if (missing.length || notFiles.length || untracked.length || absentFromHead.length || differsFromHead.length) {
  console.error("필수 파일 검증 실패 (파일 내용은 출력하지 않았습니다.)");
  process.exit(1);
}
console.log("필수 파일 검증 통과");
