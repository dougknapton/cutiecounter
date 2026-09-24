/**
 * Backend for the "Tasks" app. Bind this script to the Google Sheet
 * (Extensions > Apps Script), then:
 *   1. Project Settings > Script Properties: add SHARED_TOKEN = <long random string>
 *   2. Run setup() once from the editor (creates tabs, headers, validation).
 *   3. Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
 *
 * Requests (the client sends POST bodies as text/plain JSON to avoid a CORS preflight):
 *   GET  ?action=list&token=...                         -> { ok, compliments: [{ name, count }] }
 *   POST { action: 'addEntry', token, entry: {...} }     -> { ok, duplicate? }
 *   POST { action: 'addCompliment', token, name }        -> { ok, added }
 * Every response is JSON with ok: true/false. Errors never return ok: true.
 */

var LOG_SHEET = 'Log';
var COMPLIMENTS_SHEET = 'Compliments';
var LOG_HEADERS = ['Timestamp', 'Latitude', 'Longitude', 'Compliment', 'Gender', 'Race', 'Age Range', 'Entry ID'];
var COL_COMPLIMENT = 4; // D
var COL_ENTRY_ID = 8; // H
var SEED_COMPLIMENTS = ['So Cute', 'Cutie', 'Adorable', 'Precious', 'Baby Gorgeous'];
var MAX_TEXT = 100;

// ---------------------------------------------------------------- entry points

function doGet(e) {
  return respond_(function () {
    var params = (e && e.parameter) || {};
    checkToken_(params.token);
    if (params.action === 'list') return { compliments: listCompliments_() };
    throw new Error('Unknown action');
  });
}

function doPost(e) {
  return respond_(function () {
    var body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '');
    } catch (err) {
      throw new Error('Body must be JSON');
    }
    checkToken_(body.token);
    switch (body.action) {
      case 'addEntry':
        return addEntry_(body.entry || {});
      case 'addCompliment':
        return addCompliment_(body.name);
      default:
        throw new Error('Unknown action');
    }
  });
}

// ---------------------------------------------------------------- actions

function addEntry_(entry) {
  var id = cleanText_(entry.id);
  var compliment = cleanText_(entry.compliment);
  if (!id) throw new Error('Missing entry id');
  if (!compliment) throw new Error('Missing compliment');

  return withLock_(function () {
    var log = getSheet_(LOG_SHEET);
    // The client retries until it sees ok:true, so a request whose response was
    // lost may arrive twice. The entry id makes the append idempotent.
    if (findInColumn_(log, COL_ENTRY_ID, id)) return { duplicate: true };

    // Use the Compliments tab's spelling so the validation dropdown matches.
    compliment = ensureCompliment_(compliment).name;

    log.appendRow([
      safeCell_(cleanText_(entry.timestamp)),
      coordinate_(entry.latitude, 90),
      coordinate_(entry.longitude, 180),
      safeCell_(compliment),
      safeCell_(cleanText_(entry.gender)),
      safeCell_(cleanText_(entry.race)),
      safeCell_(cleanText_(entry.ageRange)),
      safeCell_(id),
    ]);
    return { duplicate: false };
  });
}

function addCompliment_(name) {
  name = cleanText_(name);
  if (!name) throw new Error('Missing name');
  return withLock_(function () {
    return { added: ensureCompliment_(name).added };
  });
}

/** Compliments tab entries (in sheet order) with how often each appears in the Log. */
function listCompliments_() {
  var counts = {};
  var log = getSheet_(LOG_SHEET);
  if (log.getLastRow() > 1) {
    log
      .getRange(2, COL_COMPLIMENT, log.getLastRow() - 1, 1)
      .getValues()
      .forEach(function (row) {
        var key = normalize_(row[0]);
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
  }
  return readCompliments_().map(function (name) {
    return { name: name, count: counts[normalize_(name)] || 0 };
  });
}

// ---------------------------------------------------------------- one-time setup

/** Run once from the Apps Script editor. Safe to re-run. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var compliments = ss.getSheetByName(COMPLIMENTS_SHEET) || ss.insertSheet(COMPLIMENTS_SHEET);
  if (compliments.getLastRow() === 0) {
    compliments.getRange(1, 1).setValue('Compliment').setFontWeight('bold');
    compliments.setFrozenRows(1);
  }
  if (compliments.getLastRow() < 2) {
    compliments
      .getRange(2, 1, SEED_COMPLIMENTS.length, 1)
      .setValues(SEED_COMPLIMENTS.map(function (n) { return [n]; }));
  }

  var log = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET, 0);
  log.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight('bold');
  log.setFrozenRows(1);
  // Keep the ISO 8601 timestamp exactly as sent (with its UTC offset).
  log.getRange('A2:A').setNumberFormat('@');

  // Compliment column: dropdown sourced from the Compliments tab. Invalid values
  // show a warning instead of being rejected, so an entry can never fail to save
  // because of validation. Use setAllowInvalid(false) if you prefer strict.
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(compliments.getRange('A2:A'), true)
    .setAllowInvalid(true)
    .build();
  log.getRange(2, COL_COMPLIMENT, log.getMaxRows() - 1, 1).setDataValidation(rule);

  if (!PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN')) {
    Logger.log('Reminder: add SHARED_TOKEN under Project Settings > Script Properties.');
  }
  Logger.log('Setup complete.');
}

// ---------------------------------------------------------------- helpers

function respond_(fn) {
  var payload;
  try {
    var result = fn() || {};
    result.ok = true;
    payload = result;
  } catch (err) {
    payload = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SHARED_TOKEN');
  if (!expected) throw new Error('Server token not configured');
  if (typeof token !== 'string' || !constantTimeEquals_(token, expected)) throw new Error('Unauthorized');
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Missing tab "' + name + '" (run setup())');
  return sheet;
}

function readCompliments_() {
  var sheet = getSheet_(COMPLIMENTS_SHEET);
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(function (row) { return String(row[0]).trim(); })
    .filter(function (name) { return name !== ''; });
}

/** Adds `name` to the Compliments tab unless it's already there (case-insensitive). */
function ensureCompliment_(name) {
  var existing = readCompliments_();
  for (var i = 0; i < existing.length; i++) {
    if (normalize_(existing[i]) === normalize_(name)) return { name: existing[i], added: false };
  }
  getSheet_(COMPLIMENTS_SHEET).appendRow([safeCell_(name)]);
  return { name: name, added: true };
}

function findInColumn_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return false;
  return !!sheet
    .getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(value)
    .matchEntireCell(true)
    .findNext();
}

function cleanText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

function normalize_(value) {
  return String(value || '').trim().toLowerCase();
}

/** Stops text that looks like a formula from being evaluated by Sheets. */
function safeCell_(text) {
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function coordinate_(value, limit) {
  var n = Number(value);
  if (value === '' || value === null || value === undefined || !isFinite(n) || Math.abs(n) > limit) return '';
  return n;
}
