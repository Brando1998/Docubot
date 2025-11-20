/**
 * Calcula el tiempo restante hasta una fecha futura
 * @param {string} futureDate - Fecha ISO string
 * @returns {string} Tiempo legible (ej: "12 minutes", "2 hours")
 */
function getTimeUntil(futureDate) {
  const now = new Date();
  const future = new Date(futureDate);
  const diffMs = future - now;

  if (diffMs <= 0) {
    return "now";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  }

  return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
}

/**
 * Calcula el tiempo transcurrido desde una fecha pasada
 * @param {string} pastDate - Fecha ISO string
 * @returns {string} Tiempo legible (ej: "5 minutes ago", "2 hours ago")
 */
function getTimeSince(pastDate) {
  const now = new Date();
  const past = new Date(pastDate);
  const diffMs = now - past;

  if (diffMs <= 0) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  if (diffMinutes === 0) {
    return "just now";
  }

  return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
}

module.exports = {
  getTimeUntil,
  getTimeSince,
};
