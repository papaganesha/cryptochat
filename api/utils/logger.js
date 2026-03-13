export const log = {
  info: (context, msg) => console.log(`[INFO] [${context}] ${msg}`),
  error: (context, msg, err) => console.error(`[ERROR] [${context}] ${msg}`, err || ""),
  success: (context, msg) => console.log(`[SUCCESS] [${context}] ✅ ${msg}`),
  redis: (msg) => console.log(`[REDIS] 📥 ${msg}`)
};