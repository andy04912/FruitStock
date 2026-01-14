// Use relative path derived from BASE_URL so it works under aliases (e.g. /FruitStock/api)
const URL = import.meta.env.VITE_API_URL || "http://localhost:8080"
export const API_URL = URL + "api";
