
const CFG = window.FICULLE_CONFIG;
const configured = !!(CFG && CFG.supabaseUrl && CFG.supabaseAnonKey);
const root = (CFG.supabaseUrl || "").replace(/\/$/, "");

async function rpc(fn, body = {}) {
  if (!configured) {
    throw new Error("Supabase non configurato: apri config.js.");
  }

  const response = await fetch(root + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: {
      "apikey": CFG.supabaseAnonKey,
      "Authorization": "Bearer " + CFG.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      "Errore " + response.status + ": " + text.slice(0, 240)
    );
  }

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Risposta Supabase non valida: " + text.slice(0, 150));
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  