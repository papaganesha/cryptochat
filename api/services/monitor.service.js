import { redisClient } from "../config/redis.js";
import { log } from "../utils/logger.js";
import fs from "fs"; // Para gravar o log em arquivo

export const MonitorService = {
  MAX_MEMORY_BYTES: 2 * 1024 * 1024 * 1024, // 2GB
  ALERT_THRESHOLD: 0.8,
  CRITICAL_THRESHOLD: 0.9,
  LOG_FILE: "./redis-critical.log",

  // Função interna para persistir logs importantes
  saveCriticalLog(type, message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${type}] ${message}\n`;
    fs.appendFileSync(this.LOG_FILE, entry);
  },

  async checkRedisHealth() {
    try {
      // 1. Check Latência
      const start = Date.now();
      await redisClient.ping();
      const latency = Date.now() - start;

      // 2. Check Memória
      const info = await redisClient.info('memory');
      const usedMem = parseInt(info.match(/used_memory:(\d+)/)[1]);
      const usagePercent = (usedMem / this.MAX_MEMORY_BYTES) * 100;

      // --- Lógica de Decisão de Logs ---

      // CASO 1: Latência Alta (Gargalo de Processamento)
      if (latency > 150) {
        const msg = `🐢 Latência Elevada: ${latency}ms | Uso: ${usagePercent.toFixed(2)}%`;
        log.warn("MONITOR", msg);
        this.saveCriticalLog("LATENCY_WARN", msg);
      }

      // CASO 2: Memória Crítica (Risco de Crash)
      if (usagePercent > (this.CRITICAL_THRESHOLD * 100)) {
        const msg = `🚨 LIMITE ATINGIDO: ${usagePercent.toFixed(2)}% (${(usedMem/1024/1024).toFixed(2)}MB)`;
        log.error("MONITOR", msg);
        this.saveCriticalLog("MEMORY_CRITICAL", msg);
      } 
      // CASO 3: Saudável (Apenas log de rotina no console)
      else if (usagePercent < (this.ALERT_THRESHOLD * 100)) {
        log.info("MONITOR", `✅ OK: ${usagePercent.toFixed(2)}% | ${latency}ms`);
      }

      return { usagePercent, latency };
    } catch (error) {
      const errorMsg = `Falha total no monitor: ${error.message}`;
      log.error("MONITOR", errorMsg);
      this.saveCriticalLog("SYSTEM_ERROR", errorMsg);
      return { usagePercent: 100, latency: 999 };
    }
  },

  async isSafe() {
    const health = await this.checkRedisHealth();
    return health.usagePercent < (this.CRITICAL_THRESHOLD * 100) && health.latency < 500;
  },

  stop() {
  if (this.interval) clearInterval(this.interval);
},

  start(seconds = 30) {
    log.info("MONITOR", `Vigilância iniciada. Logs críticos em: ${this.LOG_FILE}`);
    this.checkRedisHealth();
    setInterval(() => this.checkRedisHealth(), seconds * 1000);
  }
};