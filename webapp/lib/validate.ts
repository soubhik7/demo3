import type { OnboardingInput, EnvNavConfig } from './types';
import { sanitizeCountryKey, sanitizeString, sanitizeHostname } from './security';

export function validate(data: OnboardingInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data || typeof data !== 'object') {
    errors.general = 'Invalid input data structure';
    return errors;
  }

  // ── Country Key ────────────────────────────────────────────────────────────
  if (!data.country_key) {
    errors.country_key = 'Required';
  } else {
    const sanitized = sanitizeCountryKey(data.country_key);
    if (sanitized.length === 0) {
      errors.country_key = 'Must contain at least one letter';
    } else if (sanitized.length > 50) {
      errors.country_key = 'Maximum 50 characters allowed';
    } else if (!/^[a-z]+$/.test(sanitized)) {
      errors.country_key = 'Lowercase letters only (no spaces or numbers)';
    }
  }

  // ── Country Code (short routing code) ─────────────────────────────────────
  if (!data.country_code) {
    errors.country_code = 'Required — short routing code (e.g. "cz", "fr", "za")';
  } else {
    const sanitized = data.country_code.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sanitized.length === 0) {
      errors.country_code = 'Must contain at least one letter or number';
    } else if (sanitized.length > 10) {
      errors.country_code = 'Maximum 10 characters';
    }
  }

  // ── NAV Configuration ──────────────────────────────────────────────────────
  if (!data.nav || typeof data.nav !== 'object') {
    errors['nav'] = 'NAV configuration is required';
    return errors;
  }

  if (!data.nav.host) {
    errors['nav.host'] = 'Required';
  } else {
    const sanitizedHost = sanitizeHostname(data.nav.host);
    if (!sanitizedHost) {
      errors['nav.host'] = 'Invalid hostname format or blocked internal network';
    } else if (sanitizedHost.length > 253) {
      errors['nav.host'] = 'Hostname too long (max 253 characters)';
    }
  }

  if (!data.nav.company) {
    errors['nav.company'] = 'Required';
  } else if (data.nav.company.length > 200) {
    errors['nav.company'] = 'Company name too long (max 200 characters)';
  }

  if (!data.nav.soap_path) {
    errors['nav.soap_path'] = 'Required';
  } else if (data.nav.soap_path.length > 500) {
    errors['nav.soap_path'] = 'SOAP path too long (max 500 characters)';
  } else if (!/^\/[a-zA-Z0-9\/_\-\.%]+$/.test(data.nav.soap_path)) {
    errors['nav.soap_path'] = 'Invalid SOAP path format';
  }

  if (!data.nav.routing_code) {
    errors['nav.routing_code'] = 'Required';
  } else if (!/^[A-Z0-9_\-]+$/.test(data.nav.routing_code)) {
    errors['nav.routing_code'] = 'Invalid routing code format (uppercase letters, numbers, underscore, hyphen only)';
  } else if (data.nav.routing_code.length > 100) {
    errors['nav.routing_code'] = 'Routing code too long (max 100 characters)';
  }

  if (data.nav.port) {
    const port = parseInt(data.nav.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors['nav.port'] = 'Invalid port number (1-65535)';
    }
  }

  if (data.nav.soap_port) {
    const soapPort = parseInt(data.nav.soap_port, 10);
    if (isNaN(soapPort) || soapPort < 1 || soapPort > 65535) {
      errors['nav.soap_port'] = 'Invalid SOAP port number (1-65535)';
    }
  }

  if (data.nav.protocol && !['http', 'https'].includes(data.nav.protocol.toLowerCase())) {
    errors['nav.protocol'] = 'Protocol must be http or https';
  }

  // ── Transaction Types ──────────────────────────────────────────────────────
  if (!data.nav.transaction_types || typeof data.nav.transaction_types !== 'object') {
    errors.transaction_types = 'Transaction types configuration is required';
  } else {
    const enabled = Object.values(data.nav.transaction_types).filter(v => v && v.enabled);
    if (enabled.length === 0) {
      errors.transaction_types = 'Select at least one transaction type';
    }
  }

  // ── TST Nav Config (optional) ──────────────────────────────────────────────
  if (data.nav_tst) {
    const tstErrs = validateEnvNav(data.nav_tst, 'nav_tst');
    Object.assign(errors, tstErrs);
  }

  // ── PROD Nav Config (optional) ─────────────────────────────────────────────
  if (data.nav_prod) {
    const prodErrs = validateEnvNav(data.nav_prod, 'nav_prod');
    Object.assign(errors, prodErrs);
  }

  // ── Translation Configuration ──────────────────────────────────────────────
  if (!data.translation || typeof data.translation !== 'object') {
    errors['translation'] = 'Translation configuration is required';
    return errors;
  }

  if (!data.translation.receiver_name) {
    errors['translation.receiver_name'] = 'Required — enter the BTP ClientID';
  } else if (!/^[a-z0-9\-]+$/.test(data.translation.receiver_name)) {
    errors['translation.receiver_name'] = 'Invalid format (lowercase letters, numbers, hyphens only)';
  } else if (data.translation.receiver_name.length > 100) {
    errors['translation.receiver_name'] = 'Receiver name too long (max 100 characters)';
  }

  if (!Array.isArray(data.translation.message_types)) {
    errors['translation.message_types'] = 'Message types must be an array';
  } else if (data.translation.message_types.length === 0) {
    errors['translation.message_types'] = 'Select at least one message type';
  } else if (data.translation.message_types.length > 20) {
    errors['translation.message_types'] = 'Too many message types (max 20)';
  } else {
    const validMessageTypes = /^[a-zA-Z0-9_]+$/;
    for (const msgType of data.translation.message_types) {
      if (typeof msgType !== 'string' || !validMessageTypes.test(msgType)) {
        errors['translation.message_types'] = 'Invalid message type format';
        break;
      }
      if (msgType.length > 50) {
        errors['translation.message_types'] = 'Message type name too long (max 50 characters)';
        break;
      }
    }
  }

  if (!Array.isArray(data.translation.source_destination_combinations)) {
    errors.combinations = 'Source/destination combinations must be an array';
  } else if (data.translation.source_destination_combinations.length > 100) {
    errors.combinations = 'Too many combinations (max 100)';
  } else {
    const badCombos = data.translation.source_destination_combinations.filter(
      c => (c.value_from && !c.value_to) || (!c.value_from && c.value_to)
    );
    if (badCombos.length > 0) {
      errors.combinations = 'Each combination needs both ValueFrom and ValueTo';
    }
    for (const combo of data.translation.source_destination_combinations) {
      if (combo.value_from && combo.value_from.length > 200) {
        errors.combinations = 'Combination value too long (max 200 characters)'; break;
      }
      if (combo.value_to && combo.value_to.length > 200) {
        errors.combinations = 'Combination value too long (max 200 characters)'; break;
      }
    }
  }

  if (!Array.isArray(data.translation.uom_mappings)) {
    errors.uom_mappings = 'UOM mappings must be an array';
  } else if (data.translation.uom_mappings.length > 100) {
    errors.uom_mappings = 'Too many UOM mappings (max 100)';
  } else {
    for (const uom of data.translation.uom_mappings) {
      if (uom.value_from && uom.value_from.length > 50) {
        errors.uom_mappings = 'UOM value too long (max 50 characters)'; break;
      }
      if (uom.value_to && uom.value_to.length > 50) {
        errors.uom_mappings = 'UOM value too long (max 50 characters)'; break;
      }
    }
  }

  if (data.partner_comment) {
    const sanitized = sanitizeString(data.partner_comment, 500);
    if (sanitized.length > 500) {
      errors.partner_comment = 'Comment too long (max 500 characters)';
    }
  }

  if (data.created_by) {
    const sanitized = sanitizeString(data.created_by, 100);
    if (sanitized.length > 100) {
      errors.created_by = 'Created by field too long (max 100 characters)';
    }
  }

  return errors;
}

function validateEnvNav(env: EnvNavConfig, prefix: string): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!env.host) {
    errors[`${prefix}.host`] = 'Required';
  } else {
    const sanitizedHost = sanitizeHostname(env.host);
    if (!sanitizedHost) {
      errors[`${prefix}.host`] = 'Invalid hostname format or blocked internal network';
    }
  }

  if (!env.company) {
    errors[`${prefix}.company`] = 'Required';
  } else if (env.company.length > 200) {
    errors[`${prefix}.company`] = 'Company name too long (max 200 characters)';
  }

  if (!env.soap_path) {
    errors[`${prefix}.soap_path`] = 'Required';
  } else if (env.soap_path.length > 500) {
    errors[`${prefix}.soap_path`] = 'SOAP path too long (max 500 characters)';
  } else if (!/^\/[a-zA-Z0-9\/_\-\.%]+$/.test(env.soap_path)) {
    errors[`${prefix}.soap_path`] = 'Invalid SOAP path format';
  }

  if (!env.routing_code) {
    errors[`${prefix}.routing_code`] = 'Required';
  } else if (!/^[A-Z0-9_\-]+$/.test(env.routing_code)) {
    errors[`${prefix}.routing_code`] = 'Invalid routing code format';
  } else if (env.routing_code.length > 100) {
    errors[`${prefix}.routing_code`] = 'Routing code too long (max 100 characters)';
  }

  return errors;
}
