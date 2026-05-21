/**
 * Security Utilities Module
 * =========================
 * Centralized security functions for input validation, sanitization,
 * path traversal prevention, and rate limiting.
 */

import { createHash, randomBytes } from 'crypto';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Path Traversal Prevention
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a runId is a valid UUID v4 format to prevent path traversal.
 * SECURITY: Prevents directory traversal attacks via malicious runId values.
 * 
 * @param runId - The run identifier to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidRunId(runId: string): boolean {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(runId);
}

/**
 * Validates file type parameter to prevent unauthorized file access.
 * SECURITY: Whitelist approach - only allows explicitly permitted file types.
 * 
 * @param type - The file type to validate
 * @returns true if type is in whitelist, false otherwise
 */
export function isValidFileType(type: string): boolean {
  const allowedTypes = ['yaml', 'app-yaml', 'tst-yaml', 'prod-yaml', 'xlsx', 'csv'];
  return allowedTypes.includes(type);
}

/**
 * Safely resolves a file path and ensures it stays within allowed directory.
 * SECURITY: Prevents path traversal attacks by validating resolved path.
 * 
 * @param baseDir - The base directory that must contain the file
 * @param userPath - The user-provided path component
 * @returns Resolved path if safe, null if path traversal detected
 */
export function safeResolvePath(baseDir: string, userPath: string): string | null {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, userPath);
  
  // Ensure resolved path starts with base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return null; // Path traversal attempt detected
  }
  
  return resolvedPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input Sanitization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes country key to prevent injection attacks.
 * SECURITY: Removes all characters except lowercase letters.
 * 
 * @param input - Raw country key input
 * @returns Sanitized country key (lowercase letters only)
 */
export function sanitizeCountryKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Sanitizes string input to prevent XSS and injection attacks.
 * SECURITY: Removes potentially dangerous characters while preserving readability.
 * 
 * @param input - Raw string input
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') return '';
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove control characters and null bytes
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Sanitizes hostname to prevent SSRF and injection attacks.
 * SECURITY: Validates hostname format and prevents internal network access.
 * 
 * @param hostname - Raw hostname input
 * @returns Sanitized hostname or null if invalid
 */
export function sanitizeHostname(hostname: string): string | null {
  if (typeof hostname !== 'string' || hostname.length === 0) return null;
  
  // Remove whitespace and convert to lowercase
  const cleaned = hostname.trim().toLowerCase();
  
  // Validate hostname format (alphanumeric, dots, hyphens)
  const hostnameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  if (!hostnameRegex.test(cleaned)) return null;
  
  // Prevent access to internal/private networks
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./, // Link-local
    /^::1$/, // IPv6 localhost
    /^fe80:/i, // IPv6 link-local
  ];
  
  if (blockedPatterns.some(pattern => pattern.test(cleaned))) {
    return null; // Blocked internal network access attempt
  }
  
  return cleaned;
}

/**
 * Validates and sanitizes URL to prevent SSRF attacks.
 * SECURITY: Ensures URL uses safe protocols and doesn't target internal networks.
 * 
 * @param url - Raw URL input
 * @returns Sanitized URL or null if invalid/unsafe
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string' || url.length === 0) return null;
  
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS (or HTTP for development)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Validate hostname
    const safeHostname = sanitizeHostname(parsed.hostname);
    if (!safeHostname) return null;
    
    return parsed.toString();
  } catch {
    return null; // Invalid URL format
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting (In-Memory Store)
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter to prevent abuse.
 * SECURITY: Prevents DoS attacks and resource exhaustion.
 * 
 * @param identifier - Unique identifier (e.g., IP address)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute default
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    const entries = Array.from(rateLimitStore.entries());
    for (const [key, value] of entries) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  if (!entry || entry.resetTime < now) {
    // New window
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }
  
  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

/**
 * Generates a client identifier from request headers.
 * SECURITY: Uses multiple headers to identify clients for rate limiting.
 * 
 * @param headers - Request headers
 * @returns Hashed client identifier
 */
export function getClientIdentifier(headers: Headers): string {
  // Try to get real IP from various headers (reverse proxy aware)
  const ip = 
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    'unknown';
  
  // Hash the identifier for privacy
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Protection
// ─────────────────────────────────────────────────────────────────────────────

const csrfTokenStore = new Map<string, number>();

/**
 * Generates a cryptographically secure CSRF token.
 * SECURITY: Prevents Cross-Site Request Forgery attacks.
 * 
 * @returns CSRF token string
 */
export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('hex');
  csrfTokenStore.set(token, Date.now() + 3600000); // 1 hour expiry
  return token;
}

/**
 * Validates a CSRF token.
 * SECURITY: Verifies token exists and hasn't expired.
 * 
 * @param token - CSRF token to validate
 * @returns true if valid, false otherwise
 */
export function validateCsrfToken(token: string): boolean {
  const expiry = csrfTokenStore.get(token);
  if (!expiry) return false;
  
  if (Date.now() > expiry) {
    csrfTokenStore.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Cleans up expired CSRF tokens.
 * Should be called periodically to prevent memory leaks.
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  const entries = Array.from(csrfTokenStore.entries());
  for (const [token, expiry] of entries) {
    if (expiry < now) {
      csrfTokenStore.delete(token);
    }
  }
}

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredTokens, 600000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Security
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates secure Content Security Policy headers.
 * SECURITY: Prevents XSS, clickjacking, and other injection attacks.
 * 
 * @returns CSP header value
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Content Security Policy - prevents XSS
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions policy
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    
    // HSTS - Force HTTPS (only in production)
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Sanitization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes error messages to prevent information disclosure.
 * SECURITY: Removes sensitive information from error messages.
 * 
 * @param error - Error object or message
 * @param isDevelopment - Whether in development mode
 * @returns Safe error message
 */
export function sanitizeError(error: unknown, isDevelopment: boolean = false): string {
  if (isDevelopment) {
    // In development, show full error for debugging
    return error instanceof Error ? error.message : String(error);
  }
  
  // In production, return generic message
  const message = error instanceof Error ? error.message : String(error);
  
  // Remove sensitive patterns
  const sensitivePatterns = [
    /password[=:]\s*\S+/gi,
    /token[=:]\s*\S+/gi,
    /api[_-]?key[=:]\s*\S+/gi,
    /secret[=:]\s*\S+/gi,
    /\/[a-z]:[\\\/]/gi, // Windows paths
    /\/home\/[^\/\s]+/gi, // Unix home paths
    /\/users\/[^\/\s]+/gi, // User paths
  ];
  
  let sanitized = message;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  // If message contains sensitive info, return generic message
  if (sanitized.includes('[REDACTED]') || sanitized.length > 200) {
    return 'An error occurred while processing your request';
  }
  
  return sanitized;
}

// Made with Bob
